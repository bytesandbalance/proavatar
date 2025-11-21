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

    const { user_id, package: packageMinutes, payment_reference, status, price_per_minute } = await req.json();

    console.log('Webhook received:', { user_id, packageMinutes, payment_reference, status });

    // Validate input
    if (!user_id || !packageMinutes || !payment_reference || !status) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const minutes = Number(packageMinutes);
    if (!Number.isInteger(minutes) || minutes < 1) {
      return new Response(
        JSON.stringify({ error: 'Invalid package. Minutes must be a positive integer' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (status !== 'paid') {
      return new Response(
        JSON.stringify({ error: 'Payment not confirmed', received_status: status }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check if payment reference already exists
    const { data: existingPayment } = await supabase
      .from('payments')
      .select('id')
      .eq('payment_reference', payment_reference)
      .single();

    if (existingPayment) {
      console.log('Payment already processed:', payment_reference);
      return new Response(
        JSON.stringify({ message: 'Payment already processed' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get price per minute from settings or use provided value
    let pricePerMinute = price_per_minute ? Number(price_per_minute) : null;
    
    if (!pricePerMinute) {
      const { data: setting } = await supabase
        .from('settings')
        .select('value')
        .eq('key', 'price_per_minute_eur')
        .single();
      
      pricePerMinute = setting ? Number(setting.value) : 1.5; // Default fallback
    }

    const amountEur = minutes * pricePerMinute;

    // Start transaction: add credits and log payment
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('credits_in_minutes')
      .eq('id', user_id)
      .single();

    if (profileError) {
      console.error('User not found:', profileError);
      return new Response(
        JSON.stringify({ error: 'User not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Update credits
    const { error: updateError } = await supabase
      .from('profiles')
      .update({ credits_in_minutes: profile.credits_in_minutes + minutes })
      .eq('id', user_id);

    if (updateError) {
      console.error('Failed to update credits:', updateError);
      return new Response(
        JSON.stringify({ error: 'Failed to update credits' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Log payment
    const { error: paymentError } = await supabase
      .from('payments')
      .insert({
        user_id,
        package_minutes: minutes,
        amount_eur: amountEur,
        payment_reference,
      });

    if (paymentError) {
      console.error('Failed to log payment:', paymentError);
      // Try to rollback credits
      await supabase
        .from('profiles')
        .update({ credits_in_minutes: profile.credits_in_minutes })
        .eq('id', user_id);

      return new Response(
        JSON.stringify({ error: 'Failed to log payment' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Payment processed successfully:', { user_id, minutes, amountEur });

    return new Response(
      JSON.stringify({
        success: true,
        user_id,
        credits_added: minutes,
        amount_eur: amountEur,
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Webhook error:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
