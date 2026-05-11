CREATE TABLE public.requirement_item_versions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  requirement_id UUID NOT NULL,
  solicitation_id UUID NOT NULL,
  snapshot JSONB NOT NULL,
  change_summary TEXT,
  changed_by UUID,
  changed_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_req_versions_req ON public.requirement_item_versions(requirement_id, changed_at DESC);
CREATE INDEX idx_req_versions_sol ON public.requirement_item_versions(solicitation_id);

ALTER TABLE public.requirement_item_versions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "staff view requirement versions"
  ON public.requirement_item_versions FOR SELECT TO authenticated
  USING (solicitation_id IN (
    SELECT s.id FROM public.solicitations s
    JOIN public.clients c ON c.id = s.client_id
    WHERE c.organization_id = public.current_user_org()
  ));

CREATE POLICY "staff insert requirement versions"
  ON public.requirement_item_versions FOR INSERT TO authenticated
  WITH CHECK (public.is_org_staff(auth.uid()) AND solicitation_id IN (
    SELECT s.id FROM public.solicitations s
    JOIN public.clients c ON c.id = s.client_id
    WHERE c.organization_id = public.current_user_org()
  ));

CREATE OR REPLACE FUNCTION public.snapshot_requirement_item()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_changes TEXT[] := ARRAY[]::TEXT[];
BEGIN
  IF NEW.shall_text IS DISTINCT FROM OLD.shall_text THEN v_changes := array_append(v_changes, 'shall_text'); END IF;
  IF NEW.compliance_owner IS DISTINCT FROM OLD.compliance_owner THEN v_changes := array_append(v_changes, 'compliance_owner'); END IF;
  IF NEW.proposal_volume IS DISTINCT FROM OLD.proposal_volume THEN v_changes := array_append(v_changes, 'proposal_volume'); END IF;
  IF NEW.proposal_section IS DISTINCT FROM OLD.proposal_section THEN v_changes := array_append(v_changes, 'proposal_section'); END IF;
  IF NEW.status IS DISTINCT FROM OLD.status THEN v_changes := array_append(v_changes, 'status'); END IF;
  IF NEW.notes IS DISTINCT FROM OLD.notes THEN v_changes := array_append(v_changes, 'notes'); END IF;
  IF NEW.source_section IS DISTINCT FROM OLD.source_section THEN v_changes := array_append(v_changes, 'source_section'); END IF;

  IF array_length(v_changes, 1) IS NULL THEN
    RETURN NEW;
  END IF;

  INSERT INTO public.requirement_item_versions(requirement_id, solicitation_id, snapshot, change_summary, changed_by)
  VALUES (
    OLD.id,
    OLD.solicitation_id,
    to_jsonb(OLD),
    array_to_string(v_changes, ', '),
    auth.uid()
  );
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_requirement_item_snapshot
BEFORE UPDATE ON public.requirement_items
FOR EACH ROW EXECUTE FUNCTION public.snapshot_requirement_item();