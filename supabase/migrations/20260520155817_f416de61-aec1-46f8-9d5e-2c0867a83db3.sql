
ALTER TABLE public.risks
  ADD COLUMN IF NOT EXISTS sent_to_client boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS sent_to_client_at timestamptz,
  ADD COLUMN IF NOT EXISTS sent_to_client_by uuid REFERENCES public.users(id) ON DELETE SET NULL;

-- Client SELECT: any client user of the solicitation's client may view risks
CREATE POLICY "client user view risks"
  ON public.risks FOR SELECT
  TO authenticated
  USING (
    solicitation_id IN (
      SELECT s.id FROM public.solicitations s
      JOIN public.clients c ON c.id = s.client_id
      WHERE c.id = public.current_client_id()
    )
  );

-- Client UPDATE: full-access client users may update sent risks
CREATE POLICY "client update risks"
  ON public.risks FOR UPDATE
  TO authenticated
  USING (
    sent_to_client = true
    AND solicitation_id IN (
      SELECT s.id FROM public.solicitations s
      JOIN public.clients c ON c.id = s.client_id
      WHERE c.id = public.current_client_id()
        AND c.access_level = 'full'::public.client_access_level
    )
  )
  WITH CHECK (
    sent_to_client = true
    AND solicitation_id IN (
      SELECT s.id FROM public.solicitations s
      JOIN public.clients c ON c.id = s.client_id
      WHERE c.id = public.current_client_id()
        AND c.access_level = 'full'::public.client_access_level
    )
  );

-- Guard: clients may only change mitigation_strategy and is_mitigated
CREATE OR REPLACE FUNCTION public.guard_client_risk_update()
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
     OR NEW.source_document_id IS DISTINCT FROM OLD.source_document_id
     OR NEW.source_citation IS DISTINCT FROM OLD.source_citation
     OR NEW.source_quote IS DISTINCT FROM OLD.source_quote
     OR NEW.is_ai_generated IS DISTINCT FROM OLD.is_ai_generated
     OR NEW.created_by IS DISTINCT FROM OLD.created_by
     OR NEW.sent_to_client IS DISTINCT FROM OLD.sent_to_client
     OR NEW.sent_to_client_at IS DISTINCT FROM OLD.sent_to_client_at
     OR NEW.sent_to_client_by IS DISTINCT FROM OLD.sent_to_client_by
  THEN
    RAISE EXCEPTION 'Client users may only edit mitigation notes and mitigated status on risks';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_guard_client_risk_update ON public.risks;
CREATE TRIGGER trg_guard_client_risk_update
  BEFORE UPDATE ON public.risks
  FOR EACH ROW
  EXECUTE FUNCTION public.guard_client_risk_update();
