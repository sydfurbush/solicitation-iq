CREATE TABLE public.comparison_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  prior_solicitation_id uuid NOT NULL REFERENCES public.prior_solicitations(id) ON DELETE CASCADE,
  solicitation_id uuid NOT NULL,
  run_number integer NOT NULL,
  summary text,
  changes_identified jsonb,
  label text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (prior_solicitation_id, run_number)
);

CREATE INDEX idx_comparison_runs_prior ON public.comparison_runs(prior_solicitation_id, created_at DESC);
CREATE INDEX idx_comparison_runs_sol ON public.comparison_runs(solicitation_id);

ALTER TABLE public.comparison_runs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "view comparison_runs assigned"
  ON public.comparison_runs FOR SELECT
  USING (is_solicitation_member(auth.uid(), solicitation_id));

CREATE POLICY "manage comparison_runs assigned"
  ON public.comparison_runs FOR ALL
  USING (is_solicitation_member(auth.uid(), solicitation_id))
  WITH CHECK (is_solicitation_member(auth.uid(), solicitation_id));

-- Backfill: every existing completed comparison becomes run #1
INSERT INTO public.comparison_runs (prior_solicitation_id, solicitation_id, run_number, summary, changes_identified, created_at)
SELECT id, solicitation_id, 1, comparison_summary, changes_identified, COALESCE(comparison_completed_at, created_at)
FROM public.prior_solicitations
WHERE comparison_completed_at IS NOT NULL;