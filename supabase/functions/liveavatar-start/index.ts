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

    console.log('Creating LiveAvatar session...');

    // Create session with LiveAvatar API
    const response = await fetch('https://api.liveavatar.com/v1/sessions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${LIVEAVATAR_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        avatar_id: 'default', // You can customize this
        voice_id: 'default',
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('LiveAvatar API error:', response.status, errorText);
      throw new Error(`LiveAvatar API error: ${response.status}`);
    }

    const sessionData = await response.json();
    console.log('Session created:', sessionData.session_id);

    // Schedule auto-termination after 10 minutes
    const sessionId = sessionData.session_id;
    const terminateAt = Date.now() + (10 * 60 * 1000); // 10 minutes

    // Schedule background task to terminate session after 10 minutes
    setTimeout(async () => {
      console.log(`Auto-terminating session ${sessionId}`);
      try {
        await fetch(`https://api.liveavatar.com/v1/sessions/${sessionId}`, {
          method: 'DELETE',
          headers: {
            'Authorization': `Bearer ${LIVEAVATAR_API_KEY}`,
          },
        });
        console.log(`Session ${sessionId} terminated successfully`);
      } catch (error) {
        console.error(`Failed to terminate session ${sessionId}:`, error);
      }
    }, 10 * 60 * 1000);

    return new Response(
      JSON.stringify({
        ...sessionData,
        terminate_at: terminateAt,
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  } catch (error) {
    console.error('Error starting session:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
