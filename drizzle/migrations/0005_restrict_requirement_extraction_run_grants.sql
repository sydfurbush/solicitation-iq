REVOKE ALL PRIVILEGES ON TABLE public.requirement_extraction_runs FROM PUBLIC, anon, authenticated;
GRANT SELECT ON TABLE public.requirement_extraction_runs TO authenticated;
GRANT ALL PRIVILEGES ON TABLE public.requirement_extraction_runs TO service_role;