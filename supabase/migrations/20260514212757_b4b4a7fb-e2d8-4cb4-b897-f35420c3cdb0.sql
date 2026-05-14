-- Phase 2: per-run event timeline
CREATE TABLE IF NOT EXISTS public.question_generation_run_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id uuid NOT NULL,
  solicitation_id uuid NOT NULL,
  event_type text NOT NULL,
  message text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_qgre_run_id_created_at
  ON public.question_generation_run_events (run_id, created_at);
CREATE INDEX IF NOT EXISTS idx_qgre_solicitation_id
  ON public.question_generation_run_events (solicitation_id);

ALTER TABLE public.question_generation_run_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "view run events"
  ON public.question_generation_run_events
  FOR SELECT
  TO public
  USING (public.is_solicitation_member(auth.uid(), solicitation_id));

CREATE POLICY "manage run events"
  ON public.question_generation_run_events
  FOR ALL
  TO public
  USING (public.is_solicitation_member(auth.uid(), solicitation_id))
  WITH CHECK (public.is_solicitation_member(auth.uid(), solicitation_id));

-- Phase 1: callable stale-run reaper
CREATE OR REPLACE FUNCTION public.reap_stale_question_runs(
  _solicitation_id uuid,
  _threshold_minutes integer DEFAULT 8
)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  reaped integer := 0;
  r record;
  was_cross boolean;
BEGIN
  IF NOT public.is_solicitation_member(auth.uid(), _solicitation_id) THEN
    RAISE EXCEPTION 'not authorized';
  END IF;

  FOR r IN
    SELECT id, current_step
    FROM public.question_generation_runs
    WHERE solicitation_id = _solicitation_id
      AND status = 'running'
      AND updated_at < now() - make_interval(mins => _threshold_minutes)
  LOOP
    was_cross := COALESCE(lower(r.current_step) LIKE '%cross-document%', false);

    UPDATE public.question_generation_runs
       SET status = 'failed',
           cross_doc_failed = CASE WHEN was_cross THEN true ELSE cross_doc_failed END,
           failed_batches = GREATEST(failed_batches, 1),
           error_message = COALESCE(error_message, 'Run timed out (worker terminated). Retry to resume.'),
           current_step = NULL,
           completed_at = now(),
           updated_at = now()
     WHERE id = r.id
       AND status = 'running';

    INSERT INTO public.question_generation_run_events (run_id, solicitation_id, event_type, message, metadata)
    VALUES (r.id, _solicitation_id, 'reaped',
            'Run marked as failed because the worker had not reported progress.',
            jsonb_build_object('threshold_minutes', _threshold_minutes, 'was_cross_doc', was_cross));

    reaped := reaped + 1;
  END LOOP;

  RETURN reaped;
END;
$$;

GRANT EXECUTE ON FUNCTION public.reap_stale_question_runs(uuid, integer) TO authenticated;