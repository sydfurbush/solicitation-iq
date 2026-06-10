REVOKE EXECUTE ON FUNCTION public.diagnose_solicitation_create(uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.diagnose_solicitation_create(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.diagnose_solicitation_create(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.diagnose_solicitation_create(uuid) TO service_role;