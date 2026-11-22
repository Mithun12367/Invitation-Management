DROP POLICY IF EXISTS "Public can read app logo setting" ON public.app_settings;

CREATE POLICY "Public can read public app settings"
  ON public.app_settings FOR SELECT
  USING (setting_key IN ('app_logo_url', 'qr_landing_page_theme'));
