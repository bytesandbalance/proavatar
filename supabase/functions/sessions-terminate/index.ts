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

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { session_id } = await req.json();

    if (!session_id) {
      return new Response(
        JSON.stringify({ error: 'session_id is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Terminating session:', session_id);

    // Get session
    const { data: session, error: sessionError } = await supabase
      .from('sessions')
      .select('*')
      .eq('id', session_id)
      .eq('user_id', user.id)
      .single();

    if (sessionError || !session) {
      return new Response(
        JSON.stringify({ error: 'Session not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (session.status !== 'active') {
      return new Response(
        JSON.stringify({ message: 'Session already terminated', status: session.status }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Calculate minutes used based on elapsed time
    const startTime = new Date(session.start_time || session.created_at);
    const now = new Date();
    const elapsedSeconds = Math.floor((now.getTime() - startTime.getTime()) / 1000);
    const minutesUsed = Math.max(1, Math.min(
      Math.ceil(elapsedSeconds / 60),
      session.duration_minutes
    ));

    console.log('Session termination:', { 
      session_id, 
      elapsedSeconds, 
      minutesUsed, 
      requested: session.duration_minutes 
    });

    // Terminate LiveAvatar session
    if (session.session_token) {
      try {
        await fetch('https://api.liveavatar.com/v1/sessions/stop', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${session.session_token}`,
            'Content-Type': 'application/json',
            'Accept': 'application/json',
          },
        });
      } catch (error) {
        console.error('Failed to stop LiveAvatar session:', error);
        // Continue anyway to update our database
      }
    }

    // Get user's current credits
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('credits_in_minutes')
      .eq('id', user.id)
      .single();

    if (profileError || !profile) {
      console.error('Failed to get user profile:', profileError);
      return new Response(
        JSON.stringify({ error: 'Failed to get user profile' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Deduct minutes from user's credits
    const newCredits = Math.max(0, profile.credits_in_minutes - minutesUsed);
    
    const { error: updateError } = await supabase
      .from('profiles')
      .update({ credits_in_minutes: newCredits })
      .eq('id', user.id);

    if (updateError) {
      console.error('Failed to update credits:', updateError);
      return new Response(
        JSON.stringify({ error: 'Failed to update credits' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Update session status and minutes_used
    const { error: sessionUpdateError } = await supabase
      .from('sessions')
      .update({ 
        status: 'terminated',
        minutes_used: minutesUsed
      })
      .eq('id', session_id);

    if (sessionUpdateError) {
      console.error('Failed to update session:', sessionUpdateError);
      return new Response(
        JSON.stringify({ error: 'Failed to update session' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Session terminated successfully:', { minutesUsed, creditsRemaining: newCredits });

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: 'Session terminated',
        minutes_used: minutesUsed,
        credits_remaining: newCredits
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Session terminate error:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
