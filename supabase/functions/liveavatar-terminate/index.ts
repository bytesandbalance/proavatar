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

    const { session_token } = await req.json();
    if (!session_token) {
      throw new Error('session_token is required');
    }

    console.log('Stopping session...');

    const response = await fetch('https://api.liveavatar.com/v1/sessions/stop', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${session_token}`,
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
    });

    if (!response.ok && response.status !== 404) {
      const errorText = await response.text();
      console.error('LiveAvatar API error:', response.status, errorText);
      throw new Error(`Failed to terminate session: ${response.status}`);
    }

    console.log('Session terminated successfully');

    return new Response(
      JSON.stringify({ success: true }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  } catch (error) {
    console.error('Error terminating session:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
