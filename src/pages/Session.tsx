import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { ArrowLeft, Play, StopCircle } from 'lucide-react';
import { AvatarPlayer } from '@/components/AvatarPlayer';
import { CountdownTimer } from '@/components/CountdownTimer';

interface Profile {
  credits_in_minutes: number;
}

export default function Session() {
  const { user, loading: authLoading } = useAuth();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [avatarId, setAvatarId] = useState('');
  const [voiceId, setVoiceId] = useState('');
  const [contextId, setContextId] = useState('');
  const [duration, setDuration] = useState(15);
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
    } else if (user) {
      fetchProfile();
    }
  }, [user, authLoading, navigate]);

  const fetchProfile = async () => {
    try {
      const { data, error } = await supabase.functions.invoke('user-profile');
      if (error) throw error;
      setProfile(data);
    } catch (error) {
      console.error('Error fetching profile:', error);
    }
  };

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
      const { data, error } = await supabase.functions.invoke('sessions-terminate', {
        body: { session_id: session.session_id },
        headers: {
          Authorization: `Bearer ${(await supabase.auth.getSession()).data.session?.access_token}`,
        },
      });

      if (error) throw error;

      toast({
        title: 'Session Ended',
        description: `Charged ${data.minutes_used} minute${data.minutes_used !== 1 ? 's' : ''}. ${data.credits_remaining} minutes remaining.`,
      });

      setSession(null);
      setIsConnected(false);
      await fetchProfile();
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

  const maxDuration = Math.min(profile?.credits_in_minutes || 0, 120);
  const durationOptions = Array.from({ length: maxDuration }, (_, i) => i + 1);

  return (
    <div className="min-h-screen bg-background p-4">
      <div className="max-w-4xl mx-auto space-y-6">
        <div className="flex items-center gap-4">
          <Button variant="outline" onClick={() => navigate('/dashboard')}>
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Dashboard
          </Button>
          <h1 className="text-3xl font-bold">ProAvatar Session</h1>
        </div>

        {!session ? (
          <Card>
            <CardHeader>
              <CardTitle>Start a New Session</CardTitle>
              <CardDescription>
                {profile ? (
                  <>You have {profile.credits_in_minutes} minutes available. Select session duration (1-{maxDuration} min).</>
                ) : (
                  'Loading...'
                )}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="duration">Session Duration (minutes)</Label>
                <Select 
                  value={duration.toString()} 
                  onValueChange={(v) => setDuration(parseInt(v))}
                  disabled={!profile || profile.credits_in_minutes < 1}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select duration" />
                  </SelectTrigger>
                  <SelectContent className="max-h-[300px]">
                    {durationOptions.map((min) => (
                      <SelectItem key={min} value={min.toString()}>
                        {min} minute{min !== 1 ? 's' : ''}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <div className="flex gap-2 flex-wrap">
                  <span className="text-sm text-muted-foreground">Quick:</span>
                  {[5, 10, 15, 30, 60].filter(m => m <= maxDuration).map((min) => (
                    <Button
                      key={min}
                      variant="outline"
                      size="sm"
                      onClick={() => setDuration(min)}
                    >
                      {min}m
                    </Button>
                  ))}
                </div>
              </div>

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

              <Button 
                onClick={startSession} 
                disabled={loading || !profile || profile.credits_in_minutes < duration} 
                className="w-full"
              >
                <Play className="w-4 h-4 mr-2" />
                {loading ? 'Starting...' : `Start ${duration}-Minute Session`}
              </Button>

              <p className="text-xs text-muted-foreground text-center">
                Credits are only deducted when your session ends. End early to save unused minutes!
              </p>
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
              <StopCircle className="w-4 h-4 mr-2" />
              End Session Early
            </Button>

            <p className="text-xs text-muted-foreground text-center">
              You'll only be charged for time used (minimum 1 minute). Unused time stays in your account.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
