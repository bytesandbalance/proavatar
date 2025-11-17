import { useEffect, useRef } from 'react';
import { Room, RoomEvent, RemoteTrack, Track } from 'livekit-client';

interface AvatarPlayerProps {
  session: {
    session_id: string;
    websocket_url?: string;
    webrtc_url?: string;
    livekit_url?: string;
    livekit_client_token?: string;
  };
  isConnected: boolean;
}

export const AvatarPlayer = ({ session, isConnected }: AvatarPlayerProps) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const pcRef = useRef<RTCPeerConnection | null>(null);
  const roomRef = useRef<Room | null>(null);

  useEffect(() => {
    const hasLiveKit = !!session.livekit_url && !!session.livekit_client_token;

    if (hasLiveKit && videoRef.current) {
      connectLiveKit();
    } else if (session.webrtc_url && videoRef.current) {
      setupWebRTC();
    }

    return () => {
      if (pcRef.current) pcRef.current.close();
      if (roomRef.current) roomRef.current.disconnect();
    };
  }, [session.livekit_url, session.livekit_client_token, session.webrtc_url]);

  const connectLiveKit = async () => {
    if (!session.livekit_url || !session.livekit_client_token || !videoRef.current) return;

    try {
      console.log('Connecting to LiveKit:', session.livekit_url);
      const room = new Room({ adaptiveStream: true, dynacast: true });
      roomRef.current = room;

      room.on(RoomEvent.TrackSubscribed, (track: RemoteTrack) => {
        console.log('LiveKit track subscribed:', track.kind);
        if (track.kind === Track.Kind.Video && videoRef.current) {
          track.attach(videoRef.current);
          console.log('Video attached via LiveKit');
        } else if (track.kind === Track.Kind.Audio) {
          const audioEl = new Audio();
          audioEl.autoplay = true;
          track.attach(audioEl);
          console.log('Audio attached via LiveKit');
        }
      });

      room.on(RoomEvent.Disconnected, () => {
        console.log('LiveKit disconnected');
      });

      await room.connect(session.livekit_url, session.livekit_client_token);
      console.log('LiveKit connected');
    } catch (error) {
      console.error('LiveKit connection error:', error);
    }
  };

  // Fallback: generic WebRTC if a direct webrtc_url is provided
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

      // Send offer to signaling endpoint and get answer
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
        muted={true}
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
