CREATE TABLE IF NOT EXISTS public.app_settings (
  setting_key text PRIMARY KEY,
  setting_value text NOT NULL DEFAULT '',
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.app_settings ENABLE ROW LEVEL SECURITY;

GRANT SELECT ON public.app_settings TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.app_settings TO authenticated;

DROP POLICY IF EXISTS "Public can read app logo setting" ON public.app_settings;
CREATE POLICY "Public can read app logo setting"
  ON public.app_settings FOR SELECT
  USING (setting_key = 'app_logo_url');

DROP POLICY IF EXISTS "Authenticated users can manage app settings" ON public.app_settings;
CREATE POLICY "Authenticated users can manage app settings"
  ON public.app_settings FOR ALL
  USING (auth.role() = 'authenticated')
  WITH CHECK (auth.role() = 'authenticated');
