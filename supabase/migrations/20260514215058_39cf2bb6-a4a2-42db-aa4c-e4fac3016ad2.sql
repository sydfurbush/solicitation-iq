CREATE TABLE IF NOT EXISTS public.question_generation_run_chunks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id uuid NOT NULL REFERENCES public.question_generation_runs(id) ON DELETE CASCADE,
  solicitation_id uuid NOT NULL,
  chunk_index integer NOT NULL,
  kind text NOT NULL CHECK (kind IN ('doc_batch','cross_doc')),
  label text NOT NULL,
  doc_ids uuid[] NOT NULL DEFAULT '{}',
  section_slice jsonb NOT NULL DEFAULT '{}'::jsonb,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','running','completed','failed','skipped')),
  inserted_count integer NOT NULL DEFAULT 0,
  attempts integer NOT NULL DEFAULT 0,
  error_message text,
  started_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_qgrc_run_idx
  ON public.question_generation_run_chunks(run_id, chunk_index);
CREATE INDEX IF NOT EXISTS idx_qgrc_run_status
  ON public.question_generation_run_chunks(run_id, status);

ALTER TABLE public.question_generation_run_chunks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "view qgrc assigned"
  ON public.question_generation_run_chunks
  FOR SELECT
  USING (public.is_solicitation_member(auth.uid(), solicitation_id));

CREATE POLICY "manage qgrc assigned"
  ON public.question_generation_run_chunks
  FOR ALL
  USING (public.is_solicitation_member(auth.uid(), solicitation_id))
  WITH CHECK (public.is_solicitation_member(auth.uid(), solicitation_id));

CREATE TRIGGER trg_qgrc_updated_at
  BEFORE UPDATE ON public.question_generation_run_chunks
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();