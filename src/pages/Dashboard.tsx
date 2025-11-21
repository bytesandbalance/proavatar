import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { Clock, LogOut, Play, Plus } from 'lucide-react';

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
  const [minutesToPurchase, setMinutesToPurchase] = useState(15);
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

  // Calculate cost based on configurable price per minute (default 1.5 EUR)
  const pricePerMinute = 1.5;
  const totalCost = (minutesToPurchase * pricePerMinute).toFixed(2);

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
          <h1 className="text-3xl font-bold">ProAvatar Dashboard</h1>
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
              {profile.credits_in_minutes} minutes remaining
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Purchase Minutes</CardTitle>
            <CardDescription>
              Buy any amount of minutes at €{pricePerMinute.toFixed(2)} per minute
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="minutes">Number of Minutes</Label>
              <Input
                id="minutes"
                type="number"
                min="1"
                value={minutesToPurchase}
                onChange={(e) => setMinutesToPurchase(Math.max(1, parseInt(e.target.value) || 1))}
                placeholder="Enter minutes"
              />
              <p className="text-sm text-muted-foreground">
                Total cost: €{totalCost}
              </p>
            </div>

            <div className="flex gap-2">
              <Button 
                variant="outline" 
                size="sm"
                onClick={() => setMinutesToPurchase(15)}
              >
                15 min (€22.50)
              </Button>
              <Button 
                variant="outline" 
                size="sm"
                onClick={() => setMinutesToPurchase(30)}
              >
                30 min (€45.00)
              </Button>
              <Button 
                variant="outline" 
                size="sm"
                onClick={() => setMinutesToPurchase(60)}
              >
                60 min (€90.00)
              </Button>
            </div>

            <Button className="w-full" asChild>
              <a 
                href={`https://your-payment-provider.com/buy?minutes=${minutesToPurchase}&amount=${totalCost}`}
                target="_blank" 
                rel="noopener noreferrer"
              >
                <Plus className="w-4 h-4 mr-2" />
                Purchase {minutesToPurchase} Minutes
              </a>
            </Button>

            <p className="text-xs text-muted-foreground">
              After payment, your minutes will be added automatically. Minutes never expire and remain in your account until used.
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Start ProAvatar Session</CardTitle>
            <CardDescription>
              {profile.credits_in_minutes >= 1
                ? `You have ${profile.credits_in_minutes} minutes available. Choose any session length up to your balance.`
                : 'Purchase minutes to start a session'}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button
              onClick={handleStartSession}
              disabled={profile.credits_in_minutes < 1}
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
                      <p className="font-medium">{session.duration_minutes} minutes requested</p>
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
