import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey, {
      global: {
        headers: { Authorization: req.headers.get('Authorization')! },
      },
    });

    // Verify user is authenticated
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { duration, avatar_id, voice_id, context_id } = await req.json();

    console.log('Starting session for user:', user.id, 'duration:', duration);

    // Validate duration - any positive integer
    const durationMinutes = Number(duration);
    if (!Number.isInteger(durationMinutes) || durationMinutes < 1) {
      return new Response(
        JSON.stringify({ error: 'Invalid duration. Must be a positive integer (minutes)' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!avatar_id || !context_id) {
      return new Response(
        JSON.stringify({ error: 'avatar_id and context_id are required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check user has enough credits (but don't deduct yet)
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('credits_in_minutes')
      .eq('id', user.id)
      .single();

    if (profileError || !profile) {
      return new Response(
        JSON.stringify({ error: 'Profile not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (profile.credits_in_minutes < durationMinutes) {
      return new Response(
        JSON.stringify({
          error: 'Insufficient credits',
          available_credits: profile.credits_in_minutes,
          required_credits: durationMinutes,
        }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Deduct credits UP-FRONT when session starts
    const { error: deductError } = await supabase
      .from('profiles')
      .update({ credits_in_minutes: profile.credits_in_minutes - durationMinutes })
      .eq('id', user.id);

    if (deductError) {
      console.error('Failed to deduct credits:', deductError);
      return new Response(
        JSON.stringify({ error: 'Failed to deduct credits' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Credits deducted up-front:', durationMinutes, 'Remaining:', profile.credits_in_minutes - durationMinutes);

    // Start LiveAvatar session
    const LIVEAVATAR_API_KEY = Deno.env.get('LIVEAVATAR_API_KEY');
    if (!LIVEAVATAR_API_KEY) {
      throw new Error('LIVEAVATAR_API_KEY is not configured');
    }

    const tokenResponse = await fetch('https://api.liveavatar.com/v1/sessions/token', {
      method: 'POST',
      headers: {
        'X-API-KEY': LIVEAVATAR_API_KEY,
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
      body: JSON.stringify({
        mode: 'FULL',
        avatar_id,
        avatar_persona: {
          ...(voice_id && { voice_id }),
          context_id,
          language: 'en',
        },
      }),
    });

    if (!tokenResponse.ok) {
      const errorText = await tokenResponse.text();
      console.error('LiveAvatar token error:', tokenResponse.status, errorText);

      return new Response(
        JSON.stringify({ error: `Failed to create LiveAvatar session: ${errorText}` }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const tokenData = await tokenResponse.json();
    const { session_id, session_token } = tokenData.data;

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
      console.error('LiveAvatar start error:', startResponse.status, errorText);

      return new Response(
        JSON.stringify({ error: `Failed to start LiveAvatar session: ${errorText}` }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const sessionData = await startResponse.json();
    const endTime = new Date(Date.now() + durationMinutes * 60 * 1000);

    // Create session record
    const { data: sessionRecord, error: sessionError } = await supabase
      .from('sessions')
      .insert({
        user_id: user.id,
        duration_minutes: durationMinutes,
        end_time: endTime.toISOString(),
        session_token,
        avatar_id,
        voice_id: voice_id || null,
        context_id,
        status: 'active',
      })
      .select()
      .single();

    if (sessionError || !sessionRecord) {
      console.error('Failed to create session record:', sessionError);
      return new Response(
        JSON.stringify({ error: 'Failed to create session record' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Session started successfully. DB ID:', sessionRecord.id, 'LiveAvatar ID:', session_id);

    return new Response(
      JSON.stringify({
        session_id: sessionRecord.id,
        liveavatar_session_id: session_id,
        session_token,
        ...sessionData.data,
        end_time: endTime.toISOString(),
        duration_minutes: durationMinutes,
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Session start error:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
