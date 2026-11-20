-- Allow ON CONFLICT (invitation_id) to target teacher RSVPs while permitting
-- multiple public RSVP rows, whose invitation_id is NULL.
DROP INDEX IF EXISTS public.idx_rsvps_teacher_dedup;

CREATE UNIQUE INDEX idx_rsvps_teacher_dedup
  ON public.rsvps (invitation_id);
