ALTER TABLE public.question_generation_runs
  ADD COLUMN IF NOT EXISTS failed_doc_ids uuid[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS cross_doc_failed boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS parent_run_id uuid REFERENCES public.question_generation_runs(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_qgen_runs_sol_started
  ON public.question_generation_runs(solicitation_id, started_at DESC);