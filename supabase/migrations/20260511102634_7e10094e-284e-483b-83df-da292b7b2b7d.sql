
CREATE TABLE public.question_generation_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  solicitation_id uuid NOT NULL,
  status text NOT NULL DEFAULT 'running',
  total_batches integer NOT NULL DEFAULT 0,
  completed_batches integer NOT NULL DEFAULT 0,
  failed_batches integer NOT NULL DEFAULT 0,
  inserted_count integer NOT NULL DEFAULT 0,
  current_step text,
  error_message text,
  started_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz
);

CREATE INDEX idx_qgr_solicitation ON public.question_generation_runs(solicitation_id, started_at DESC);

ALTER TABLE public.question_generation_runs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "staff manage qgen runs"
ON public.question_generation_runs
FOR ALL
TO authenticated
USING (
  public.is_org_staff(auth.uid())
  AND solicitation_id IN (
    SELECT s.id FROM public.solicitations s
    JOIN public.clients c ON c.id = s.client_id
    WHERE c.organization_id = public.current_user_org()
  )
)
WITH CHECK (
  public.is_org_staff(auth.uid())
  AND solicitation_id IN (
    SELECT s.id FROM public.solicitations s
    JOIN public.clients c ON c.id = s.client_id
    WHERE c.organization_id = public.current_user_org()
  )
);

CREATE POLICY "staff view qgen runs"
ON public.question_generation_runs
FOR SELECT
TO authenticated
USING (
  solicitation_id IN (
    SELECT s.id FROM public.solicitations s
    JOIN public.clients c ON c.id = s.client_id
    WHERE c.organization_id = public.current_user_org()
  )
);

ALTER PUBLICATION supabase_realtime ADD TABLE public.question_generation_runs;
