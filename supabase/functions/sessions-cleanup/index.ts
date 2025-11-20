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
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    console.log('Running session cleanup...');

    // Find all active sessions past their end time
    const { data: expiredSessions, error: fetchError } = await supabase
      .from('sessions')
      .select('*')
      .eq('status', 'active')
      .lt('end_time', new Date().toISOString());

    if (fetchError) {
      console.error('Failed to fetch expired sessions:', fetchError);
      return new Response(
        JSON.stringify({ error: 'Failed to fetch expired sessions' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!expiredSessions || expiredSessions.length === 0) {
      console.log('No expired sessions found');
      return new Response(
        JSON.stringify({ message: 'No expired sessions', terminated_count: 0 }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Found ${expiredSessions.length} expired sessions`);

    let terminatedCount = 0;

    // Terminate each expired session
    for (const session of expiredSessions) {
      try {
        // Try to stop LiveAvatar session
        if (session.session_token) {
          await fetch('https://api.liveavatar.com/v1/sessions/stop', {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${session.session_token}`,
              'Content-Type': 'application/json',
              'Accept': 'application/json',
            },
          });
        }

        // Update session status
        const { error: updateError } = await supabase
          .from('sessions')
          .update({ status: 'completed' })
          .eq('id', session.id);

        if (updateError) {
          console.error(`Failed to update session ${session.id}:`, updateError);
        } else {
          terminatedCount++;
          console.log(`Terminated session ${session.id}`);
        }
      } catch (error) {
        console.error(`Error terminating session ${session.id}:`, error);
      }
    }

    console.log(`Cleanup complete. Terminated ${terminatedCount} sessions`);

    return new Response(
      JSON.stringify({
        success: true,
        terminated_count: terminatedCount,
        total_expired: expiredSessions.length,
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Cleanup error:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
