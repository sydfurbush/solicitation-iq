ALTER TABLE public.capability_gaps
  ADD COLUMN IF NOT EXISTS sent_to_client boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS sent_to_client_at timestamptz,
  ADD COLUMN IF NOT EXISTS sent_to_client_by uuid REFERENCES public.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS client_response text,
  ADD COLUMN IF NOT EXISTS client_responded_at timestamptz,
  ADD COLUMN IF NOT EXISTS client_confirmed boolean;

-- Client portal: view gaps sent to them
DROP POLICY IF EXISTS "client user view sent gaps" ON public.capability_gaps;
CREATE POLICY "client user view sent gaps"
ON public.capability_gaps
FOR SELECT
TO authenticated
USING (
  sent_to_client = true
  AND solicitation_id IN (
    SELECT s.id FROM public.solicitations s
    WHERE s.client_id = public.current_client_id()
  )
);

-- Client portal: update only their own response fields on sent gaps
DROP POLICY IF EXISTS "client user update sent gaps" ON public.capability_gaps;
CREATE POLICY "client user update sent gaps"
ON public.capability_gaps
FOR UPDATE
TO authenticated
USING (
  sent_to_client = true
  AND solicitation_id IN (
    SELECT s.id FROM public.solicitations s
    WHERE s.client_id = public.current_client_id()
  )
)
WITH CHECK (
  sent_to_client = true
  AND solicitation_id IN (
    SELECT s.id FROM public.solicitations s
    WHERE s.client_id = public.current_client_id()
  )
);

-- Guard: clients can only modify response fields
CREATE OR REPLACE FUNCTION public.guard_client_gap_update()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_client_user(auth.uid()) THEN
    RETURN NEW;
  END IF;

  IF NEW.solicitation_id IS DISTINCT FROM OLD.solicitation_id
     OR NEW.title IS DISTINCT FROM OLD.title
     OR NEW.description IS DISTINCT FROM OLD.description
     OR NEW.severity IS DISTINCT FROM OLD.severity
     OR NEW.gap_type IS DISTINCT FROM OLD.gap_type
     OR NEW.recommendation IS DISTINCT FROM OLD.recommendation
     OR NEW.requirement_id IS DISTINCT FROM OLD.requirement_id
     OR NEW.client_note IS DISTINCT FROM OLD.client_note
     OR NEW.is_resolved IS DISTINCT FROM OLD.is_resolved
     OR NEW.is_ai_generated IS DISTINCT FROM OLD.is_ai_generated
     OR NEW.sent_to_client IS DISTINCT FROM OLD.sent_to_client
     OR NEW.sent_to_client_at IS DISTINCT FROM OLD.sent_to_client_at
     OR NEW.sent_to_client_by IS DISTINCT FROM OLD.sent_to_client_by
  THEN
    RAISE EXCEPTION 'Client users may only edit response fields on capability gaps';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_guard_client_gap_update ON public.capability_gaps;
CREATE TRIGGER trg_guard_client_gap_update
  BEFORE UPDATE ON public.capability_gaps
  FOR EACH ROW
  EXECUTE FUNCTION public.guard_client_gap_update();