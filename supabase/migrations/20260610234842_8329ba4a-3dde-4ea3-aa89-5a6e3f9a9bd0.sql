
REVOKE EXECUTE ON FUNCTION public.assistant_check_and_increment(uuid, integer, integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.assistant_check_and_increment(uuid, integer, integer) TO authenticated, service_role;
