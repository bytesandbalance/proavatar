import { useLiveAvatar } from '@/hooks/useLiveAvatar';
import { AvatarPlayer } from '@/components/AvatarPlayer';
import { AvatarSelector } from '@/components/AvatarSelector';
import { CountdownTimer } from '@/components/CountdownTimer';
import { Button } from '@/components/ui/button';
import { Power } from 'lucide-react';

const Index = () => {
  const { 
    session, 
    isConnecting, 
    isConnected,
    timeRemaining,
    formattedTime,
    startSession,
    endSession 
  } = useLiveAvatar();

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-background/95">
      <div className="container mx-auto px-4 py-8 h-screen flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold bg-gradient-to-r from-primary to-cyan-500 bg-clip-text text-transparent">
              ProAvatar
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
            <AvatarSelector 
              onStart={startSession}
              isConnecting={isConnecting}
            />
          ) : (
            /* Active session */
            <div className="w-full h-full max-w-6xl mx-auto flex flex-col gap-6 animate-fade-in">
              {/* Avatar Player */}
              <div className="flex-1 relative">
                <AvatarPlayer
                  session={session}
                  isConnected={isConnected}
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
