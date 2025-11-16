import { useState, useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface LiveAvatarSession {
  session_id: string;
  session_token: string;
  websocket_url?: string;
  webrtc_url?: string;
  terminate_at: number;
}

export const useLiveAvatar = () => {
  const [session, setSession] = useState<LiveAvatarSession | null>(null);
  const [isConnecting, setIsConnecting] = useState(false);
  const [isConnected, setIsConnected] = useState(false);
  const [timeRemaining, setTimeRemaining] = useState<number>(0);
  const wsRef = useRef<WebSocket | null>(null);
  const { toast } = useToast();

  // Countdown timer
  useEffect(() => {
    if (!session) return;

    const interval = setInterval(() => {
      const remaining = Math.max(0, session.terminate_at - Date.now());
      setTimeRemaining(remaining);

      if (remaining === 0) {
        handleSessionEnd();
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [session]);

  const startSession = async (avatarId: string, voiceId: string, contextId?: string) => {
    setIsConnecting(true);
    
    try {
      console.log('Starting LiveAvatar session with avatar:', avatarId, 'voice:', voiceId);
      
      const { data, error } = await supabase.functions.invoke('liveavatar-start', {
        body: { 
          avatar_id: avatarId,
          voice_id: voiceId,
          ...(contextId && { context_id: contextId })
        }
      });
      
      if (error) throw error;
      
      console.log('Session started:', data);
      setSession(data);
      
      // Connect WebSocket if URL provided
      if (data.websocket_url) {
        connectWebSocket(data.websocket_url);
      } else {
        // Session is ready even without WebSocket
        setIsConnected(true);
      }
      
      toast({
        title: "Session Started",
        description: "Your ProAvatar session is ready",
      });
    } catch (error) {
      console.error('Failed to start session:', error);
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : 'Failed to start session',
        variant: "destructive",
      });
    } finally {
      setIsConnecting(false);
    }
  };

  const connectWebSocket = (url: string) => {
    console.log('Connecting to WebSocket:', url);
    
    const ws = new WebSocket(url);
    
    ws.onopen = () => {
      console.log('WebSocket connected');
      setIsConnected(true);
    };
    
    ws.onmessage = (event) => {
      console.log('WebSocket message:', event.data);
      // Handle incoming messages from LiveAvatar
    };
    
    ws.onerror = (error) => {
      console.error('WebSocket error:', error);
      toast({
        title: "Connection Error",
        description: "Failed to connect to ProAvatar",
        variant: "destructive",
      });
    };
    
    ws.onclose = () => {
      console.log('WebSocket closed');
      setIsConnected(false);
    };
    
    wsRef.current = ws;
  };

  const endSession = async () => {
    if (!session) return;
    
    try {
      console.log('Ending session manually...');
      
      await supabase.functions.invoke('liveavatar-terminate', {
        body: { session_token: session.session_token }
      });
      
      handleSessionEnd();
      
      toast({
        title: "Session Ended",
        description: "Your session has been terminated",
      });
    } catch (error) {
      console.error('Failed to end session:', error);
      toast({
        title: "Error",
        description: "Failed to end session",
        variant: "destructive",
      });
    }
  };

  const handleSessionEnd = () => {
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }
    setSession(null);
    setIsConnected(false);
    setTimeRemaining(0);
  };

  const formatTime = (ms: number) => {
    const totalSeconds = Math.floor(ms / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
  };

  return {
    session,
    isConnecting,
    isConnected,
    timeRemaining,
    formattedTime: formatTime(timeRemaining),
    startSession,
    endSession,
  };
};
