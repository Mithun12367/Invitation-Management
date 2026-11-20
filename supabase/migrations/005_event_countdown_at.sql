ALTER TABLE public.events
  ADD COLUMN IF NOT EXISTS countdown_at timestamptz;
