-- ============================================================
-- 001_initial_schema.sql
-- HDU Cultural Festival – Complete Database Schema
-- ============================================================

-- =========================
-- 1. TRIGGER FUNCTIONS
-- =========================

-- Auto-create a profile row when a new user signs up
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data ->> 'full_name', '')
  );
  RETURN NEW;
END;
$$;

-- Auto-update updated_at on row modification
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- =========================
-- 2. TABLES
-- =========================

-- profiles
CREATE TABLE public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email text,
  full_name text,
  role text DEFAULT 'admin',
  created_at timestamptz DEFAULT now()
);

-- teachers
CREATE TABLE public.teachers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  full_name text NOT NULL,
  designation text,
  department text,
  personalized_message text,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- events
CREATE TABLE public.events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  description text,
  event_date timestamptz,
  event_timezone text DEFAULT 'Asia/Shanghai',
  venue text,
  organizer text,
  poster_url text,
  background_music_url text,
  is_published boolean DEFAULT false,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- invitation_templates
CREATE TABLE public.invitation_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  template_name text NOT NULL,
  template_type text CHECK (template_type IN ('teacher', 'public')),
  background_url text,
  editor_configuration jsonb DEFAULT '{}',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- invitations
CREATE TABLE public.invitations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  teacher_id uuid REFERENCES public.teachers(id) ON DELETE CASCADE,
  event_id uuid REFERENCES public.events(id) ON DELETE CASCADE NOT NULL,
  token_hash text UNIQUE NOT NULL,
  invitation_status text CHECK (invitation_status IN ('active', 'revoked', 'expired')) DEFAULT 'active',
  qr_image_url text,
  template_id uuid REFERENCES public.invitation_templates(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- rsvps
CREATE TABLE public.rsvps (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  invitation_id uuid REFERENCES public.invitations(id) ON DELETE CASCADE,
  event_id uuid REFERENCES public.events(id) ON DELETE CASCADE NOT NULL,
  guest_name text,
  response text CHECK (response IN ('accepted', 'maybe', 'declined')) NOT NULL,
  guest_count integer DEFAULT 1 CHECK (guest_count >= 1),
  contact_information text,
  invitation_category text CHECK (invitation_category IN ('teacher', 'public')) NOT NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Partial unique index to deduplicate teacher RSVPs
CREATE UNIQUE INDEX idx_rsvps_teacher_dedup
  ON public.rsvps (invitation_id)
  WHERE invitation_id IS NOT NULL;

-- public_settings
CREATE TABLE public.public_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id uuid REFERENCES public.events(id) ON DELETE CASCADE UNIQUE NOT NULL,
  public_token text UNIQUE NOT NULL,
  welcome_message text,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- qr_scans
CREATE TABLE public.qr_scans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  invitation_id uuid REFERENCES public.invitations(id) ON DELETE SET NULL,
  event_id uuid REFERENCES public.events(id) ON DELETE CASCADE,
  invitation_category text CHECK (invitation_category IN ('teacher', 'public')),
  scanned_at timestamptz DEFAULT now()
);

-- media_assets
CREATE TABLE public.media_assets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id uuid REFERENCES public.events(id) ON DELETE CASCADE,
  asset_type text,
  file_name text,
  file_url text NOT NULL,
  file_size bigint,
  mime_type text,
  created_at timestamptz DEFAULT now()
);

-- =========================
-- 3. TRIGGERS
-- =========================

-- Create profile on new auth.users signup
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

-- updated_at triggers
CREATE TRIGGER set_teachers_updated_at
  BEFORE UPDATE ON public.teachers
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER set_events_updated_at
  BEFORE UPDATE ON public.events
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER set_invitation_templates_updated_at
  BEFORE UPDATE ON public.invitation_templates
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER set_invitations_updated_at
  BEFORE UPDATE ON public.invitations
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER set_rsvps_updated_at
  BEFORE UPDATE ON public.rsvps
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER set_public_settings_updated_at
  BEFORE UPDATE ON public.public_settings
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- =========================
-- 4. INDEXES
-- =========================

CREATE INDEX idx_invitations_token_hash ON public.invitations (token_hash);
CREATE INDEX idx_invitations_teacher_id ON public.invitations (teacher_id);
CREATE INDEX idx_invitations_event_id   ON public.invitations (event_id);
CREATE INDEX idx_rsvps_invitation_id    ON public.rsvps (invitation_id);
CREATE INDEX idx_rsvps_event_id         ON public.rsvps (event_id);
CREATE INDEX idx_qr_scans_event_id      ON public.qr_scans (event_id);
CREATE INDEX idx_teachers_department    ON public.teachers (department);

-- =========================
-- 5. ROW LEVEL SECURITY
-- =========================

-- ---- profiles ----
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own profile"
  ON public.profiles FOR SELECT
  USING (auth.uid() = id);

CREATE POLICY "Profiles are created via trigger only"
  ON public.profiles FOR INSERT
  WITH CHECK (false);

-- ---- teachers ----
ALTER TABLE public.teachers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can do everything with teachers"
  ON public.teachers FOR ALL
  USING (auth.role() = 'authenticated')
  WITH CHECK (auth.role() = 'authenticated');

-- ---- events ----
ALTER TABLE public.events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view published events"
  ON public.events FOR SELECT
  USING (is_published = true OR auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can manage events"
  ON public.events FOR ALL
  USING (auth.role() = 'authenticated')
  WITH CHECK (auth.role() = 'authenticated');

-- ---- invitation_templates ----
ALTER TABLE public.invitation_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can manage templates"
  ON public.invitation_templates FOR ALL
  USING (auth.role() = 'authenticated')
  WITH CHECK (auth.role() = 'authenticated');

-- ---- invitations ----
ALTER TABLE public.invitations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can manage invitations"
  ON public.invitations FOR ALL
  USING (auth.role() = 'authenticated')
  WITH CHECK (auth.role() = 'authenticated');

-- ---- rsvps ----
ALTER TABLE public.rsvps ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view RSVPs"
  ON public.rsvps FOR SELECT
  USING (auth.role() = 'authenticated');

CREATE POLICY "Anyone can submit a public RSVP"
  ON public.rsvps FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Authenticated users can update RSVPs"
  ON public.rsvps FOR UPDATE
  USING (auth.role() = 'authenticated')
  WITH CHECK (auth.role() = 'authenticated');

-- ---- public_settings ----
ALTER TABLE public.public_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view active public settings"
  ON public.public_settings FOR SELECT
  USING (is_active = true OR auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can manage public settings"
  ON public.public_settings FOR ALL
  USING (auth.role() = 'authenticated')
  WITH CHECK (auth.role() = 'authenticated');

-- ---- qr_scans ----
ALTER TABLE public.qr_scans ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can insert a scan record"
  ON public.qr_scans FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Authenticated users can view scan records"
  ON public.qr_scans FOR SELECT
  USING (auth.role() = 'authenticated');

-- ---- media_assets ----
ALTER TABLE public.media_assets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view media assets"
  ON public.media_assets FOR SELECT
  USING (true);

CREATE POLICY "Authenticated users can insert media assets"
  ON public.media_assets FOR INSERT
  WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can update media assets"
  ON public.media_assets FOR UPDATE
  USING (auth.role() = 'authenticated')
  WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can delete media assets"
  ON public.media_assets FOR DELETE
  USING (auth.role() = 'authenticated');

-- =========================
-- 6. SEED DATA
-- =========================

INSERT INTO public.events (id, title, description, venue, organizer, is_published)
VALUES (
  'a0000000-0000-0000-0000-000000000001',
  'HDU Cultural Festival 2026',
  'Annual cultural festival celebrating diversity and talent at Hangzhou Dianzi University.',
  'HDU Main Auditorium',
  'HDU Student Union',
  true
);

INSERT INTO public.public_settings (event_id, public_token, welcome_message, is_active)
VALUES (
  'a0000000-0000-0000-0000-000000000001',
  'hdu-cultural-fest-2026-public',
  'Welcome to the HDU Cultural Festival 2026! We are delighted to have you join us.',
  true
);
