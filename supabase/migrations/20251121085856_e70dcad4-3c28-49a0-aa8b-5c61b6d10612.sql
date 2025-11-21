-- Add minutes_used column to sessions table
ALTER TABLE public.sessions 
ADD COLUMN minutes_used integer DEFAULT NULL;

-- Add requested_minutes column (rename from duration_minutes conceptually)
-- We'll keep duration_minutes but add a comment for clarity
COMMENT ON COLUMN public.sessions.duration_minutes IS 'Requested session duration in minutes';
COMMENT ON COLUMN public.sessions.minutes_used IS 'Actual minutes consumed when session ends';

-- Update status to support all states: active, terminated, expired, cleaned
-- (already text type, so just add comment)
COMMENT ON COLUMN public.sessions.status IS 'Session status: active, terminated, expired, cleaned';

-- Create a settings table for configurable values like price per minute
CREATE TABLE IF NOT EXISTS public.settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  key text UNIQUE NOT NULL,
  value text NOT NULL,
  description text,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);

ALTER TABLE public.settings ENABLE ROW LEVEL SECURITY;

-- Allow anyone to read settings (they're public config values)
CREATE POLICY "Settings are publicly readable"
ON public.settings
FOR SELECT
USING (true);

-- Insert default price per minute (1.5 EUR)
INSERT INTO public.settings (key, value, description)
VALUES ('price_per_minute_eur', '1.5', 'Price in EUR per minute of LiveAvatar session')
ON CONFLICT (key) DO NOTHING;

-- Add trigger for settings updated_at
CREATE TRIGGER update_settings_updated_at
BEFORE UPDATE ON public.settings
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at();

-- Add index on sessions for cleanup queries
CREATE INDEX IF NOT EXISTS idx_sessions_active_cleanup 
ON public.sessions(status, start_time, end_time) 
WHERE status = 'active';