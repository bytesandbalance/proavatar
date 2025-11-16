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

    const { avatar_id, voice_id, context_id } = await req.json();
    
    if (!avatar_id) {
      throw new Error('avatar_id is required. Please provide a valid avatar_id from your LiveAvatar account.');
    }
    
    if (!voice_id) {
      throw new Error('voice_id is required. Please provide a valid voice_id from your LiveAvatar account.');
    }

    console.log('Creating LiveAvatar session token with avatar:', avatar_id, 'voice:', voice_id);

    // Step 1: Create session token
    const tokenResponse = await fetch('https://api.liveavatar.com/v1/sessions/token', {
      method: 'POST',
      headers: {
        'X-API-KEY': LIVEAVATAR_API_KEY,
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
      body: JSON.stringify(
        context_id
          ? {
              mode: 'FULL',
              avatar_id,
              avatar_persona: {
                voice_id,
                context_id,
                language: 'en',
              },
            }
          : {
              avatar_id,
              avatar_persona: {
                voice_id,
                language: 'en',
              },
            }
      ),
    });

    if (!tokenResponse.ok) {
      const errorText = await tokenResponse.text();
      console.error('LiveAvatar token API error:', tokenResponse.status, errorText);
      throw new Error(`LiveAvatar token API error: ${tokenResponse.status}`);
    }

    const tokenData = await tokenResponse.json();
    const { session_id, session_token } = tokenData.data;
    console.log('Session token created:', session_id);

    // Step 2: Start the session
    console.log('Starting LiveAvatar session...');
    const startResponse = await fetch('https://api.liveavatar.com/v1/sessions/start', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${session_token}`,
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
    });

    if (!startResponse.ok) {
      const errorText = await startResponse.text();
      console.error('LiveAvatar start API error:', startResponse.status, errorText);
      throw new Error(`LiveAvatar start API error: ${startResponse.status}`);
    }

    const sessionData = await startResponse.json();
    console.log('Session started successfully');

    // Schedule auto-termination after 10 minutes
    const terminateAt = Date.now() + (10 * 60 * 1000); // 10 minutes

    // Schedule background task to terminate session after 10 minutes
    setTimeout(async () => {
      console.log(`Auto-terminating session ${session_id}`);
      try {
        await fetch('https://api.liveavatar.com/v1/sessions/stop', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${session_token}`,
            'Content-Type': 'application/json',
            'Accept': 'application/json',
          },
        });
        console.log(`Session ${session_id} terminated successfully`);
      } catch (error) {
        console.error(`Failed to terminate session ${session_id}:`, error);
      }
    }, 10 * 60 * 1000);

    return new Response(
      JSON.stringify({
        session_id: session_id,
        session_token: session_token,
        ...sessionData.data,
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
