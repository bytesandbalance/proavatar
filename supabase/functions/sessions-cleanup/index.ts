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

    // Find all active sessions past their end time + grace period (5 minutes)
    const gracePeriodMs = 5 * 60 * 1000;
    const cleanupThreshold = new Date(Date.now() - gracePeriodMs);
    
    const { data: expiredSessions, error: fetchError } = await supabase
      .from('sessions')
      .select('*')
      .eq('status', 'active')
      .lt('end_time', cleanupThreshold.toISOString());

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

    // Cleanup each abandoned session
    for (const session of expiredSessions) {
      try {
        // Calculate minutes used (up to requested duration)
        const startTime = new Date(session.start_time || session.created_at);
        const endTime = new Date(session.end_time);
        const elapsedSeconds = Math.floor((endTime.getTime() - startTime.getTime()) / 1000);
        const minutesUsed = Math.max(1, Math.min(
          Math.ceil(elapsedSeconds / 60),
          session.duration_minutes
        ));

        console.log(`Cleaning up session ${session.id}:`, { 
          minutesUsed, 
          requested: session.duration_minutes,
          note: 'No refund - credits already deducted at session start'
        });

        // Try to stop LiveAvatar session
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
            console.error(`Failed to stop LiveAvatar for session ${session.id}:`, error);
          }
        }

        // NO credit deduction here - credits were already deducted at session start
        // Expired/abandoned sessions get NO refund

        // Update session status and minutes_used
        const { error: updateError } = await supabase
          .from('sessions')
          .update({ 
            status: 'cleaned',
            minutes_used: minutesUsed
          })
          .eq('id', session.id);

        if (updateError) {
          console.error(`Failed to update session ${session.id}:`, updateError);
        } else {
          terminatedCount++;
          console.log(`Cleaned up session ${session.id}: ${minutesUsed} minutes charged`);
        }
      } catch (error) {
        console.error(`Error cleaning up session ${session.id}:`, error);
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
