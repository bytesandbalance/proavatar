import { useEffect, useRef } from 'react';

interface AvatarPlayerProps {
  sessionId: string;
  websocketUrl?: string;
  webrtcUrl?: string;
}

export const AvatarPlayer = ({ sessionId, websocketUrl, webrtcUrl }: AvatarPlayerProps) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const pcRef = useRef<RTCPeerConnection | null>(null);

  useEffect(() => {
    if (webrtcUrl && videoRef.current) {
      setupWebRTC();
    }

    return () => {
      if (pcRef.current) {
        pcRef.current.close();
      }
    };
  }, [webrtcUrl]);

  const setupWebRTC = async () => {
    if (!webrtcUrl || !videoRef.current) return;

    try {
      console.log('Setting up WebRTC connection...');
      
      const pc = new RTCPeerConnection({
        iceServers: [{ urls: 'stun:stun.l.google.com:19302' }]
      });

      pc.ontrack = (event) => {
        console.log('Received remote track');
        if (videoRef.current) {
          videoRef.current.srcObject = event.streams[0];
        }
      };

      pc.onicecandidate = (event) => {
        if (event.candidate) {
          console.log('ICE candidate:', event.candidate);
        }
      };

      pcRef.current = pc;

      // Create offer and connect to LiveAvatar
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);

      // Send offer to LiveAvatar API (this would need the actual endpoint)
      console.log('WebRTC offer created');
      
    } catch (error) {
      console.error('WebRTC setup error:', error);
    }
  };

  return (
    <div className="relative w-full h-full bg-black/50 rounded-lg overflow-hidden backdrop-blur-sm border border-border/20">
      <video
        ref={videoRef}
        autoPlay
        playsInline
        muted={false}
        className="w-full h-full object-cover"
      />
      
      {/* Session ID overlay */}
      <div className="absolute bottom-4 left-4 px-3 py-1.5 bg-black/70 backdrop-blur-sm rounded-md">
        <p className="text-xs text-muted-foreground font-mono">
          Session: {sessionId.slice(0, 8)}...
        </p>
      </div>
    </div>
  );
};
