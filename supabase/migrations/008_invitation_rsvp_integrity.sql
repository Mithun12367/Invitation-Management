UPDATE public.rsvps AS rsvp
SET guest_id = invitation.guest_id
FROM public.invitations AS invitation
WHERE rsvp.invitation_id = invitation.id
  AND rsvp.invitation_category = 'teacher'
  AND rsvp.guest_id IS NULL;

WITH unique_teacher_names AS (
  SELECT
    id,
    lower(trim(full_name)) AS normalized_name,
    count(*) OVER (PARTITION BY lower(trim(full_name))) AS name_count
  FROM public.guests
  WHERE guest_type IN ('teacher', 'professor')
)
UPDATE public.rsvps AS rsvp
SET guest_id = teacher.id
FROM unique_teacher_names AS teacher
WHERE rsvp.invitation_category = 'teacher'
  AND rsvp.invitation_id IS NULL
  AND rsvp.guest_id IS NULL
  AND rsvp.guest_name IS NOT NULL
  AND lower(trim(rsvp.guest_name)) = teacher.normalized_name
  AND teacher.name_count = 1;

CREATE UNIQUE INDEX IF NOT EXISTS idx_rsvps_teacher_event_once
  ON public.rsvps (guest_id, event_id)
  WHERE invitation_category = 'teacher' AND guest_id IS NOT NULL;

CREATE OR REPLACE FUNCTION public.delete_invitation_with_rsvps(p_invitation_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Authentication required' USING ERRCODE = '42501';
  END IF;

  IF p_invitation_id IS NULL THEN
    RAISE EXCEPTION 'Invitation id is required' USING ERRCODE = '22004';
  END IF;

  DELETE FROM public.rsvps
  WHERE invitation_id = p_invitation_id;

  DELETE FROM public.invitations
  WHERE id = p_invitation_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Invitation not found' USING ERRCODE = 'P0002';
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.delete_invitation_with_rsvps(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.delete_invitation_with_rsvps(uuid) TO authenticated;
