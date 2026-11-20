-- ============================================================
-- 002_storage_setup.sql
-- Storage buckets and RLS policies for file uploads
-- ============================================================

-- =========================
-- 1. STORAGE BUCKETS
-- =========================

INSERT INTO storage.buckets (id, name, public)
VALUES
  ('posters',     'posters',     true),
  ('backgrounds', 'backgrounds', true),
  ('qr-codes',    'qr-codes',    false),
  ('music',       'music',       true),
  ('media',       'media',       true);

-- =========================
-- 2. STORAGE POLICIES
-- =========================

-- ---- posters (public read, authenticated write) ----

CREATE POLICY "Public read access for posters"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'posters');

CREATE POLICY "Authenticated users can upload posters"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'posters' AND auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can update posters"
  ON storage.objects FOR UPDATE
  USING (bucket_id = 'posters' AND auth.role() = 'authenticated')
  WITH CHECK (bucket_id = 'posters' AND auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can delete posters"
  ON storage.objects FOR DELETE
  USING (bucket_id = 'posters' AND auth.role() = 'authenticated');

-- ---- backgrounds (public read, authenticated write) ----

CREATE POLICY "Public read access for backgrounds"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'backgrounds');

CREATE POLICY "Authenticated users can upload backgrounds"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'backgrounds' AND auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can update backgrounds"
  ON storage.objects FOR UPDATE
  USING (bucket_id = 'backgrounds' AND auth.role() = 'authenticated')
  WITH CHECK (bucket_id = 'backgrounds' AND auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can delete backgrounds"
  ON storage.objects FOR DELETE
  USING (bucket_id = 'backgrounds' AND auth.role() = 'authenticated');

-- ---- qr-codes (private – authenticated only) ----

CREATE POLICY "Authenticated users can read QR codes"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'qr-codes' AND auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can upload QR codes"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'qr-codes' AND auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can update QR codes"
  ON storage.objects FOR UPDATE
  USING (bucket_id = 'qr-codes' AND auth.role() = 'authenticated')
  WITH CHECK (bucket_id = 'qr-codes' AND auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can delete QR codes"
  ON storage.objects FOR DELETE
  USING (bucket_id = 'qr-codes' AND auth.role() = 'authenticated');

-- ---- music (public read, authenticated write) ----

CREATE POLICY "Public read access for music"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'music');

CREATE POLICY "Authenticated users can upload music"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'music' AND auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can update music"
  ON storage.objects FOR UPDATE
  USING (bucket_id = 'music' AND auth.role() = 'authenticated')
  WITH CHECK (bucket_id = 'music' AND auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can delete music"
  ON storage.objects FOR DELETE
  USING (bucket_id = 'music' AND auth.role() = 'authenticated');

-- ---- media (public read, authenticated write) ----

CREATE POLICY "Public read access for media"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'media');

CREATE POLICY "Authenticated users can upload media"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'media' AND auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can update media"
  ON storage.objects FOR UPDATE
  USING (bucket_id = 'media' AND auth.role() = 'authenticated')
  WITH CHECK (bucket_id = 'media' AND auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can delete media"
  ON storage.objects FOR DELETE
  USING (bucket_id = 'media' AND auth.role() = 'authenticated');
