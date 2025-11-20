import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { Clock, LogOut, Play } from 'lucide-react';

interface Profile {
  id: string;
  email: string;
  credits_in_minutes: number;
  created_at: string;
  updated_at: string;
  active_sessions: any[];
}

export default function Dashboard() {
  const { user, signOut, loading: authLoading } = useAuth();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();
  const navigate = useNavigate();

  useEffect(() => {
    if (!authLoading && !user) {
      navigate('/auth');
    }
  }, [user, authLoading, navigate]);

  useEffect(() => {
    if (user) {
      fetchProfile();
    }
  }, [user]);

  const fetchProfile = async () => {
    try {
      const { data, error } = await supabase.functions.invoke('user-profile', {
        headers: {
          Authorization: `Bearer ${(await supabase.auth.getSession()).data.session?.access_token}`,
        },
      });

      if (error) throw error;

      setProfile(data);
    } catch (error) {
      console.error('Error fetching profile:', error);
      toast({
        title: 'Error',
        description: 'Failed to load profile',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleStartSession = () => {
    navigate('/session');
  };

  const handleSignOut = async () => {
    await signOut();
    navigate('/auth');
  };

  if (authLoading || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p>Loading...</p>
      </div>
    );
  }

  if (!profile) {
    return null;
  }

  return (
    <div className="min-h-screen bg-background p-4">
      <div className="max-w-4xl mx-auto space-y-6">
        <div className="flex justify-between items-center">
          <h1 className="text-3xl font-bold">LiveAvatar Dashboard</h1>
          <Button variant="outline" onClick={handleSignOut}>
            <LogOut className="w-4 h-4 mr-2" />
            Sign Out
          </Button>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Your Credits</CardTitle>
            <CardDescription>{profile.email}</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2 text-2xl font-bold">
              <Clock className="w-6 h-6" />
              {profile.credits_in_minutes} minutes
            </div>
          </CardContent>
        </Card>

        <div className="grid md:grid-cols-2 gap-4">
          <Card>
            <CardHeader>
              <CardTitle>15-Minute Package</CardTitle>
              <CardDescription>€22.50</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Perfect for quick sessions and demos
              </p>
              <Button className="w-full" variant="outline" asChild>
                <a href="https://your-payment-provider.com/15min" target="_blank" rel="noopener noreferrer">
                  Purchase 15 Minutes
                </a>
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>30-Minute Package</CardTitle>
              <CardDescription>€45.00</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Best value for extended conversations
              </p>
              <Button className="w-full" variant="outline" asChild>
                <a href="https://your-payment-provider.com/30min" target="_blank" rel="noopener noreferrer">
                  Purchase 30 Minutes
                </a>
              </Button>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Start LiveAvatar Session</CardTitle>
            <CardDescription>
              {profile.credits_in_minutes >= 15
                ? 'You have enough credits to start a session'
                : 'Purchase credits to start a session'}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button
              onClick={handleStartSession}
              disabled={profile.credits_in_minutes < 15}
              className="w-full"
            >
              <Play className="w-4 h-4 mr-2" />
              Start Session
            </Button>
          </CardContent>
        </Card>

        {profile.active_sessions && profile.active_sessions.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle>Active Sessions</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {profile.active_sessions.map((session: any) => (
                  <div key={session.id} className="flex justify-between items-center p-3 border rounded">
                    <div>
                      <p className="font-medium">{session.duration_minutes} minutes</p>
                      <p className="text-sm text-muted-foreground">
                        Ends: {new Date(session.end_time).toLocaleString()}
                      </p>
                    </div>
                    <Badge>Active</Badge>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
