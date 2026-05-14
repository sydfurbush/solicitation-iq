REVOKE EXECUTE ON FUNCTION public.reap_stale_question_runs(uuid, integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.reap_stale_question_runs(uuid, integer) TO authenticated;