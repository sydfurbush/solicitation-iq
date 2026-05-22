CREATE TABLE public.analysis_jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  solicitation_id uuid NOT NULL,
  analysis_type text NOT NULL DEFAULT 'full',
  status text NOT NULL DEFAULT 'queued',
  progress_step text,
  error_message text,
  requested_by uuid,
  started_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_analysis_jobs_sol ON public.analysis_jobs(solicitation_id, created_at DESC);

ALTER TABLE public.analysis_jobs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "view analysis_jobs assigned"
ON public.analysis_jobs FOR SELECT
USING (public.is_solicitation_member(auth.uid(), solicitation_id));

CREATE POLICY "insert analysis_jobs assigned"
ON public.analysis_jobs FOR INSERT
WITH CHECK (public.is_solicitation_member(auth.uid(), solicitation_id));

CREATE TRIGGER trg_analysis_jobs_updated_at
BEFORE UPDATE ON public.analysis_jobs
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

ALTER PUBLICATION supabase_realtime ADD TABLE public.analysis_jobs;
ALTER TABLE public.analysis_jobs REPLICA IDENTITY FULL;