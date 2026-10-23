ALTER TABLE public.requirement_items
  ADD COLUMN origin text NOT NULL DEFAULT 'ai' CHECK (origin IN ('ai', 'import', 'manual')),
  ADD COLUMN external_id text,
  ADD COLUMN import_source text,
  ADD COLUMN area text,
  ADD COLUMN requirement_type text,
  ADD COLUMN applicability text NOT NULL DEFAULT 'proposal' CHECK (applicability IN ('proposal', 'post_award')),
  ADD COLUMN response_evidence text,
  ADD COLUMN workflow_status text NOT NULL DEFAULT 'not_started' CHECK (workflow_status IN ('not_started', 'drafted', 'pending_customer', 'pending_government', 'pending_pricing', 'final_review', 'ready')),
  ADD COLUMN action_needed text,
  ADD COLUMN criticality text CHECK (criticality IN ('high', 'medium', 'low')),
  ADD COLUMN needs_clarification boolean NOT NULL DEFAULT false,
  ADD COLUMN verified_at timestamptz,
  ADD COLUMN verified_by uuid,
  ADD COLUMN covered_by_id uuid REFERENCES public.requirement_items(id) ON DELETE SET NULL;

UPDATE public.requirement_items SET origin = 'manual' WHERE is_ai_generated = false;

CREATE INDEX requirement_items_covered_by_id_idx ON public.requirement_items (covered_by_id);
CREATE UNIQUE INDEX requirement_items_solicitation_external_id_uidx ON public.requirement_items (solicitation_id, external_id) WHERE external_id IS NOT NULL;

CREATE TABLE public.requirement_extraction_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  solicitation_id uuid NOT NULL REFERENCES public.solicitations(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'running' CHECK (status IN ('running', 'completed', 'failed')),
  total_batches int NOT NULL DEFAULT 0,
  completed_batches int NOT NULL DEFAULT 0,
  failed_batches int NOT NULL DEFAULT 0,
  inserted_count int NOT NULL DEFAULT 0,
  duplicate_count int NOT NULL DEFAULT 0,
  current_step text,
  error_message text,
  created_by uuid,
  started_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz
);
GRANT SELECT ON public.requirement_extraction_runs TO authenticated;
GRANT ALL ON public.requirement_extraction_runs TO service_role;
ALTER TABLE public.requirement_extraction_runs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Staff can view accessible requirement extraction runs"
  ON public.requirement_extraction_runs FOR SELECT TO authenticated
  USING (public.is_org_staff(auth.uid()) AND public.is_solicitation_member(auth.uid(), solicitation_id));
CREATE INDEX requirement_extraction_runs_solicitation_started_idx ON public.requirement_extraction_runs (solicitation_id, started_at DESC);