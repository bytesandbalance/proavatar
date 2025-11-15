import { Button } from "@/components/ui/button";
import { useLiveAvatar } from "@/hooks/useLiveAvatar";
import { AvatarPlayer } from "@/components/AvatarPlayer";
import { CountdownTimer } from "@/components/CountdownTimer";
import { Loader2, Power, Play } from "lucide-react";

const Index = () => {
  const {
    session,
    isConnecting,
    isConnected,
    timeRemaining,
    formattedTime,
    startSession,
    endSession,
  } = useLiveAvatar();

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-background/95">
      <div className="container mx-auto px-4 py-8 h-screen flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold bg-gradient-to-r from-primary to-cyan-500 bg-clip-text text-transparent">
              LiveAvatar
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              Real-time AI Avatar Sessions
            </p>
          </div>
          
          {session && (
            <CountdownTimer 
              timeRemaining={timeRemaining} 
              formattedTime={formattedTime} 
            />
          )}
        </div>

        {/* Main Content */}
        <div className="flex-1 flex items-center justify-center">
          {!session ? (
            /* Pre-session state */
            <div className="text-center space-y-8 animate-fade-in">
              <div className="space-y-4">
                <div className="w-20 h-20 mx-auto rounded-full bg-primary/10 flex items-center justify-center">
                  <Play className="w-10 h-10 text-primary" />
                </div>
                <h2 className="text-2xl font-semibold">Start Your Avatar Session</h2>
                <p className="text-muted-foreground max-w-md mx-auto">
                  Sessions are automatically optimized for instant loading and will terminate after 10 minutes
                </p>
              </div>
              
              <Button
                onClick={startSession}
                disabled={isConnecting}
                size="lg"
                className="px-8 py-6 text-lg"
              >
                {isConnecting ? (
                  <>
                    <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                    Connecting...
                  </>
                ) : (
                  <>
                    <Play className="mr-2 h-5 w-5" />
                    Start Session
                  </>
                )}
              </Button>
            </div>
          ) : (
            /* Active session */
            <div className="w-full h-full max-w-6xl mx-auto flex flex-col gap-6 animate-fade-in">
              {/* Avatar Player */}
              <div className="flex-1 relative">
                {!isConnected && (
                  <div className="absolute inset-0 flex items-center justify-center bg-black/50 backdrop-blur-sm rounded-lg z-10">
                    <div className="text-center space-y-4">
                      <Loader2 className="w-12 h-12 animate-spin text-primary mx-auto" />
                      <p className="text-muted-foreground">Establishing connection...</p>
                    </div>
                  </div>
                )}
                
                <AvatarPlayer
                  sessionId={session.session_id}
                  websocketUrl={session.websocket_url}
                  webrtcUrl={session.webrtc_url}
                />
              </div>

              {/* Controls */}
              <div className="flex justify-center">
                <Button
                  onClick={endSession}
                  variant="destructive"
                  size="lg"
                  className="px-8"
                >
                  <Power className="mr-2 h-5 w-5" />
                  End Session Now
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Index;
