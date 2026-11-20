ALTER TABLE public.invitations
  ADD COLUMN IF NOT EXISTS letter_content text,
  ADD COLUMN IF NOT EXISTS animation_url text,
  ADD COLUMN IF NOT EXISTS landing_page_config jsonb NOT NULL DEFAULT '{}'::jsonb;
