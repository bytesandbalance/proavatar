import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const LIVEAVATAR_API_KEY = Deno.env.get('LIVEAVATAR_API_KEY');
    if (!LIVEAVATAR_API_KEY) {
      throw new Error('LIVEAVATAR_API_KEY is not configured');
    }

    console.log('Fetching LiveAvatar resources...');

    // Try to fetch avatars list
    const avatarsResponse = await fetch('https://api.liveavatar.com/v1/avatars', {
      method: 'GET',
      headers: {
        'X-API-KEY': LIVEAVATAR_API_KEY,
        'Accept': 'application/json',
      },
    });

    // Try to fetch voices list
    const voicesResponse = await fetch('https://api.liveavatar.com/v1/voices', {
      method: 'GET',
      headers: {
        'X-API-KEY': LIVEAVATAR_API_KEY,
        'Accept': 'application/json',
      },
    });

    const resources: any = {};

    if (avatarsResponse.ok) {
      resources.avatars = await avatarsResponse.json();
      console.log('Avatars fetched successfully');
    } else {
      console.error('Failed to fetch avatars:', avatarsResponse.status);
      resources.avatars_error = `Failed to fetch avatars: ${avatarsResponse.status}`;
    }

    if (voicesResponse.ok) {
      resources.voices = await voicesResponse.json();
      console.log('Voices fetched successfully');
    } else {
      console.error('Failed to fetch voices:', voicesResponse.status);
      resources.voices_error = `Failed to fetch voices: ${voicesResponse.status}`;
    }

    return new Response(
      JSON.stringify(resources),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  } catch (error) {
    console.error('Error fetching resources:', error);
    return new Response(
      JSON.stringify({ 
        error: error instanceof Error ? error.message : 'Unknown error',
        note: 'You may need to check the LiveAvatar documentation for available avatar_id and voice_id values, or use the LiveAvatar dashboard to find them.'
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
