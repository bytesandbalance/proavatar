import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Loader2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface AvatarSelectorProps {
  onStart: (avatarId: string, voiceId: string, contextId?: string) => void;
  isConnecting: boolean;
}

export const AvatarSelector = ({ onStart, isConnecting }: AvatarSelectorProps) => {
  const [avatarId, setAvatarId] = useState('');
  const [voiceId, setVoiceId] = useState('');
  const [contextId, setContextId] = useState('');
  const [isLoadingResources, setIsLoadingResources] = useState(false);
  const { toast } = useToast();

  const loadResources = async () => {
    setIsLoadingResources(true);
    try {
      const { data, error } = await supabase.functions.invoke('liveavatar-list-resources');

      if (error) throw error;

      console.log('Available resources:', data);

      // If we got avatars/voices, could auto-populate them here
      if (data.avatars?.data?.[0]) {
        setAvatarId(data.avatars.data[0].id || '');
      }
      if (data.voices?.data?.[0]) {
        setVoiceId(data.voices.data[0].id || '');
      }

      toast({
        title: "Resources Loaded",
        description: "Check console for available avatars and voices",
      });
    } catch (error) {
      console.error('Failed to load resources:', error);
      toast({
        title: "Unable to Load Resources",
        description: "Please enter your avatar and voice IDs manually",
        variant: "destructive",
      });
    } finally {
      setIsLoadingResources(false);
    }
  };

  const handleStart = () => {
    if (!avatarId || !contextId) {
      toast({
        title: "Missing Information",
        description: "Please provide Avatar ID and Context ID",
        variant: "destructive",
      });
      return;
    }

    onStart(avatarId, voiceId || undefined, contextId);
  };

  return (
    <Card className="w-full max-w-md mx-auto">
      <CardHeader>
        <CardTitle>Configure ProAvatar</CardTitle>
        <CardDescription>
          Enter your avatar and voice IDs from your LiveAvatar dashboard
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="avatar-id">Avatar ID *</Label>
          <Input
            id="avatar-id"
            placeholder="e.g., avatar_abc123"
            value={avatarId}
            onChange={(e) => setAvatarId(e.target.value)}
            disabled={isConnecting}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="voice-id">Voice ID (optional)</Label>
          <Input
            id="voice-id"
            placeholder="e.g., voice_xyz789 (leave empty for default)"
            value={voiceId}
            onChange={(e) => setVoiceId(e.target.value)}
            disabled={isConnecting}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="context-id">Context ID *</Label>
          <Input
            id="context-id"
            placeholder="e.g., context_def456"
            value={contextId}
            onChange={(e) => setContextId(e.target.value)}
            disabled={isConnecting}
          />
        </div>

        <div className="flex gap-2">
          <Button
            onClick={loadResources}
            variant="outline"
            disabled={isLoadingResources || isConnecting}
            className="flex-1"
          >
            {isLoadingResources && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Try Auto-Load
          </Button>

          <Button
            onClick={handleStart}
            disabled={isConnecting || !avatarId || !contextId}
            className="flex-1"
          >
            {isConnecting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Start Session
          </Button>
        </div>

        <p className="text-sm text-muted-foreground">
          Find your IDs in the{' '}
          <a
            href="https://app.liveavatar.com"
            target="_blank"
            rel="noopener noreferrer"
            className="underline hover:text-foreground"
          >
            LiveAvatar dashboard
          </a>
        </p>
      </CardContent>
    </Card>
  );
};
