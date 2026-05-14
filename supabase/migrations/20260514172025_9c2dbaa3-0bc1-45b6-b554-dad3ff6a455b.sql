DO $$ BEGIN
  CREATE TYPE public.field_proposal_status AS ENUM ('pending', 'accepted', 'rejected', 'superseded');
EXCEPTION WHEN duplicate_object THEN null; END $$;

ALTER TABLE public.solicitations
  ADD COLUMN IF NOT EXISTS overview_autofill jsonb NOT NULL DEFAULT '{}'::jsonb;

CREATE TABLE IF NOT EXISTS public.solicitation_field_proposals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  solicitation_id uuid NOT NULL,
  field_name text NOT NULL,
  current_value jsonb,
  proposed_value jsonb NOT NULL,
  confidence numeric,
  source_document_id uuid,
  source_section_id uuid,
  source_quote text,
  status public.field_proposal_status NOT NULL DEFAULT 'pending',
  decided_by uuid,
  decided_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_field_proposals_sol_status
  ON public.solicitation_field_proposals (solicitation_id, status);

ALTER TABLE public.solicitation_field_proposals ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "staff manage field proposals" ON public.solicitation_field_proposals;
CREATE POLICY "staff manage field proposals"
  ON public.solicitation_field_proposals
  FOR ALL TO authenticated
  USING (public.is_solicitation_member(auth.uid(), solicitation_id))
  WITH CHECK (public.is_solicitation_member(auth.uid(), solicitation_id));

DROP POLICY IF EXISTS "client view field proposals" ON public.solicitation_field_proposals;
CREATE POLICY "client view field proposals"
  ON public.solicitation_field_proposals
  FOR SELECT TO authenticated
  USING (
    solicitation_id IN (
      SELECT s.id FROM public.solicitations s
      JOIN public.clients c ON c.id = s.client_id
      WHERE c.id = current_client_id() AND c.access_level = 'full'::client_access_level
    )
  );

CREATE OR REPLACE FUNCTION public.touch_field_proposals()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_field_proposals_touch ON public.solicitation_field_proposals;
CREATE TRIGGER trg_field_proposals_touch
  BEFORE UPDATE ON public.solicitation_field_proposals
  FOR EACH ROW EXECUTE FUNCTION public.touch_field_proposals();