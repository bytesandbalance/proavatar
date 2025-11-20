import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { ArrowLeft } from 'lucide-react';
import { AvatarPlayer } from '@/components/AvatarPlayer';
import { CountdownTimer } from '@/components/CountdownTimer';

export default function Session() {
  const { user, loading: authLoading } = useAuth();
  const [avatarId, setAvatarId] = useState('');
  const [voiceId, setVoiceId] = useState('');
  const [contextId, setContextId] = useState('');
  const [duration, setDuration] = useState<15 | 30>(15);
  const [session, setSession] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [timeRemaining, setTimeRemaining] = useState(0);
  const [formattedTime, setFormattedTime] = useState('00:00');
  const [isConnected, setIsConnected] = useState(false);
  const { toast } = useToast();
  const navigate = useNavigate();

  useEffect(() => {
    if (!authLoading && !user) {
      navigate('/auth');
    }
  }, [user, authLoading, navigate]);

  // Countdown timer effect
  useEffect(() => {
    if (!session?.end_time) return;

    const interval = setInterval(() => {
      const remaining = new Date(session.end_time).getTime() - Date.now();
      
      if (remaining <= 0) {
        setTimeRemaining(0);
        setFormattedTime('00:00');
        endSession();
        clearInterval(interval);
      } else {
        setTimeRemaining(remaining);
        const minutes = Math.floor(remaining / 60000);
        const seconds = Math.floor((remaining % 60000) / 1000);
        setFormattedTime(`${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`);
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [session?.end_time]);

  const startSession = async () => {
    if (!avatarId || !contextId) {
      toast({
        title: 'Error',
        description: 'Please provide Avatar ID and Context ID',
        variant: 'destructive',
      });
      return;
    }

    setLoading(true);

    try {
      const { data, error } = await supabase.functions.invoke('sessions-start', {
        body: {
          duration,
          avatar_id: avatarId,
          voice_id: voiceId || undefined,
          context_id: contextId,
        },
        headers: {
          Authorization: `Bearer ${(await supabase.auth.getSession()).data.session?.access_token}`,
        },
      });

      if (error) throw error;

      setSession(data);
      setIsConnected(true);
      toast({
        title: 'Session Started',
        description: `Your ${duration}-minute session is now active`,
      });
    } catch (error: any) {
      console.error('Error starting session:', error);
      toast({
        title: 'Error',
        description: error.message || 'Failed to start session',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const endSession = async () => {
    if (!session) return;

    try {
      await supabase.functions.invoke('sessions-terminate', {
        body: { session_id: session.session_id },
        headers: {
          Authorization: `Bearer ${(await supabase.auth.getSession()).data.session?.access_token}`,
        },
      });

      toast({
        title: 'Session Ended',
        description: 'Your session has been terminated',
      });

      setSession(null);
      setIsConnected(false);
    } catch (error: any) {
      console.error('Error ending session:', error);
      toast({
        title: 'Error',
        description: error.message || 'Failed to end session',
        variant: 'destructive',
      });
    }
  };

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p>Loading...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background p-4">
      <div className="max-w-4xl mx-auto space-y-6">
        <div className="flex items-center gap-4">
          <Button variant="outline" onClick={() => navigate('/')}>
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Dashboard
          </Button>
          <h1 className="text-3xl font-bold">LiveAvatar Session</h1>
        </div>

        {!session ? (
          <Card>
            <CardHeader>
              <CardTitle>Start a New Session</CardTitle>
              <CardDescription>
                Configure your LiveAvatar session settings
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="avatarId">Avatar ID *</Label>
                <Input
                  id="avatarId"
                  value={avatarId}
                  onChange={(e) => setAvatarId(e.target.value)}
                  placeholder="Enter Avatar ID"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="voiceId">Voice ID (Optional)</Label>
                <Input
                  id="voiceId"
                  value={voiceId}
                  onChange={(e) => setVoiceId(e.target.value)}
                  placeholder="Enter Voice ID"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="contextId">Context ID *</Label>
                <Input
                  id="contextId"
                  value={contextId}
                  onChange={(e) => setContextId(e.target.value)}
                  placeholder="Enter Context ID"
                />
              </div>

              <div className="space-y-2">
                <Label>Session Duration</Label>
                <div className="grid grid-cols-2 gap-4">
                  <Button
                    variant={duration === 15 ? 'default' : 'outline'}
                    onClick={() => setDuration(15)}
                  >
                    15 Minutes
                  </Button>
                  <Button
                    variant={duration === 30 ? 'default' : 'outline'}
                    onClick={() => setDuration(30)}
                  >
                    30 Minutes
                  </Button>
                </div>
              </div>

              <Button onClick={startSession} disabled={loading} className="w-full">
                {loading ? 'Starting...' : 'Start Session'}
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Session Active</CardTitle>
                <CardDescription>
                  Your {session.duration_minutes}-minute session is running
                </CardDescription>
              </CardHeader>
              <CardContent>
                <CountdownTimer timeRemaining={timeRemaining} formattedTime={formattedTime} />
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-0">
                <AvatarPlayer
                  session={session}
                  isConnected={isConnected}
                  onSendMessage={() => {}}
                />
              </CardContent>
            </Card>

            <Button onClick={endSession} variant="destructive" className="w-full">
              End Session
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
