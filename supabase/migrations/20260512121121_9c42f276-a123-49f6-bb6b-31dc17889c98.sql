
CREATE TABLE public.phase_approvals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  solicitation_id uuid NOT NULL,
  phase phase_type NOT NULL,
  status text NOT NULL DEFAULT 'not_ready' CHECK (status IN ('not_ready','pending_review','approved','changes_requested')),
  requested_at timestamptz,
  requested_by uuid,
  decided_at timestamptz,
  decided_by uuid,
  decided_by_name text,
  decision_note text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (solicitation_id, phase)
);

CREATE INDEX idx_phase_approvals_sol ON public.phase_approvals(solicitation_id);

ALTER TABLE public.phase_approvals ENABLE ROW LEVEL SECURITY;

-- Staff: full management
CREATE POLICY "staff manage phase approvals"
ON public.phase_approvals
FOR ALL
TO authenticated
USING (
  is_org_staff(auth.uid()) AND solicitation_id IN (
    SELECT s.id FROM solicitations s JOIN clients c ON c.id = s.client_id
    WHERE c.organization_id = current_user_org()
  )
)
WITH CHECK (
  is_org_staff(auth.uid()) AND solicitation_id IN (
    SELECT s.id FROM solicitations s JOIN clients c ON c.id = s.client_id
    WHERE c.organization_id = current_user_org()
  )
);

-- Staff: view (mirrors other tables)
CREATE POLICY "view phase approvals"
ON public.phase_approvals
FOR SELECT
TO authenticated
USING (
  solicitation_id IN (
    SELECT s.id FROM solicitations s JOIN clients c ON c.id = s.client_id
    WHERE c.organization_id = current_user_org()
  )
);

-- Client users: view their own (any access level)
CREATE POLICY "client user view phase approvals"
ON public.phase_approvals
FOR SELECT
TO authenticated
USING (
  solicitation_id IN (
    SELECT id FROM solicitations WHERE client_id = current_client_id()
  )
);

-- Client users: decide while pending
CREATE POLICY "client user decide phase approvals"
ON public.phase_approvals
FOR UPDATE
TO authenticated
USING (
  status = 'pending_review' AND solicitation_id IN (
    SELECT id FROM solicitations WHERE client_id = current_client_id()
  )
)
WITH CHECK (
  solicitation_id IN (
    SELECT id FROM solicitations WHERE client_id = current_client_id()
  )
);

-- updated_at trigger
CREATE TRIGGER trg_phase_approvals_updated
BEFORE UPDATE ON public.phase_approvals
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- Activity log trigger
CREATE OR REPLACE FUNCTION public.log_phase_approval_activity()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF TG_OP = 'UPDATE' AND NEW.status IS DISTINCT FROM OLD.status THEN
    PERFORM public.log_activity(
      NEW.solicitation_id,
      auth.uid(),
      'phase_approval_' || NEW.status,
      'Phase ' || NEW.phase::text || ' approval: ' || NEW.status,
      'phase_approval',
      NEW.id,
      jsonb_build_object('phase', NEW.phase::text, 'status', NEW.status, 'note', NEW.decision_note)
    );
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_phase_approvals_activity
AFTER UPDATE ON public.phase_approvals
FOR EACH ROW EXECUTE FUNCTION public.log_phase_approval_activity();

-- Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.phase_approvals;
ALTER TABLE public.phase_approvals REPLICA IDENTITY FULL;
