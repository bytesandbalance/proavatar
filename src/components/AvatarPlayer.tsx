import { useEffect, useRef } from 'react';

interface AvatarPlayerProps {
  session: {
    session_id: string;
    websocket_url?: string;
    webrtc_url?: string;
  };
  isConnected: boolean;
}

export const AvatarPlayer = ({ session, isConnected }: AvatarPlayerProps) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const pcRef = useRef<RTCPeerConnection | null>(null);

  useEffect(() => {
    if (session.webrtc_url && videoRef.current) {
      setupWebRTC();
    }

    return () => {
      if (pcRef.current) {
        pcRef.current.close();
      }
    };
  }, [session.webrtc_url]);

  const setupWebRTC = async () => {
    if (!session.webrtc_url || !videoRef.current) return;

    try {
      console.log('Setting up WebRTC connection to:', session.webrtc_url);
      
      const pc = new RTCPeerConnection({
        iceServers: [{ urls: 'stun:stun.l.google.com:19302' }]
      });

      pc.ontrack = (event) => {
        console.log('Received remote track:', event.streams[0]);
        if (videoRef.current && event.streams[0]) {
          videoRef.current.srcObject = event.streams[0];
          console.log('Video stream connected');
        }
      };

      pc.onicecandidate = (event) => {
        if (event.candidate) {
          console.log('ICE candidate:', event.candidate);
        }
      };

      pc.oniceconnectionstatechange = () => {
        console.log('ICE connection state:', pc.iceConnectionState);
      };

      pcRef.current = pc;

      // Create offer
      const offer = await pc.createOffer({
        offerToReceiveAudio: true,
        offerToReceiveVideo: true
      });
      await pc.setLocalDescription(offer);
      console.log('Created WebRTC offer');

      // Send offer to LiveAvatar and get answer
      const response = await fetch(session.webrtc_url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          sdp: offer.sdp,
          type: offer.type
        })
      });

      if (!response.ok) {
        throw new Error(`WebRTC signaling failed: ${response.status}`);
      }

      const answer = await response.json();
      console.log('Received WebRTC answer');

      await pc.setRemoteDescription(new RTCSessionDescription(answer));
      console.log('WebRTC connection established');
      
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
          Session: {session.session_id.slice(0, 8)}...
          {isConnected && <span className="ml-2 text-green-400">● Live</span>}
        </p>
      </div>
    </div>
  );
};
