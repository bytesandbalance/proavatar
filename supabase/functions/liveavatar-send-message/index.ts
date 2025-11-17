import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { session_token, text } = await req.json();

    if (!session_token || !text) {
      throw new Error('session_token and text are required');
    }

    const LIVEAVATAR_API_KEY = Deno.env.get('LIVEAVATAR_API_KEY');
    if (!LIVEAVATAR_API_KEY) {
      throw new Error('LIVEAVATAR_API_KEY not configured');
    }

    console.log('Sending message to LiveAvatar session...');

    const response = await fetch('https://api.us.platform.liveavatar.tech/v1/sessions/chat', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${session_token}`,
        'X-API-Key': LIVEAVATAR_API_KEY,
      },
      body: JSON.stringify({
        text,
        stream: false
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('LiveAvatar chat API error:', response.status, errorText);
      throw new Error(`Failed to send message (${response.status}): ${errorText}`);
    }

    const data = await response.json();
    console.log('Message sent successfully:', data);

    return new Response(JSON.stringify(data), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error sending message:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
