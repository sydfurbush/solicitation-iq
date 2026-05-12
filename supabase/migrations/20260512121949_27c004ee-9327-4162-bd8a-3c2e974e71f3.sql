
-- 1. Drop the public-read SELECT policies on public buckets (files remain accessible via public URLs)
DROP POLICY IF EXISTS "avatars public read" ON storage.objects;
DROP POLICY IF EXISTS "brand-assets public read" ON storage.objects;
DROP POLICY IF EXISTS "client-logos public read" ON storage.objects;

-- 2. Lock down SECURITY DEFINER functions

-- Trigger-only functions: no direct callers needed
REVOKE ALL ON FUNCTION public.update_updated_at() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.log_solicitation_status_change() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.log_annotation_activity() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.log_document_activity() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.log_phase_approval_activity() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.snapshot_requirement_item() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.create_report_version() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;

-- log_activity is invoked by other SECURITY DEFINER trigger functions only
REVOKE ALL ON FUNCTION public.log_activity(uuid, uuid, text, text, text, uuid, jsonb) FROM PUBLIC, anon, authenticated;

-- Helper functions used by RLS policies: revoke from PUBLIC/anon, keep authenticated
REVOKE ALL ON FUNCTION public.current_user_org() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.current_user_org() TO authenticated;

REVOKE ALL ON FUNCTION public.current_client_id() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.current_client_id() TO authenticated;

REVOKE ALL ON FUNCTION public.has_role(uuid, app_role) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, app_role) TO authenticated;

REVOKE ALL ON FUNCTION public.is_org_staff(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_org_staff(uuid) TO authenticated;

REVOKE ALL ON FUNCTION public.is_client_user(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_client_user(uuid) TO authenticated;
