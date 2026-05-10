
REVOKE EXECUTE ON FUNCTION public.log_activity(UUID, UUID, TEXT, TEXT, TEXT, UUID, JSONB) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.log_document_activity() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.log_annotation_activity() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.log_solicitation_status_change() FROM PUBLIC, anon, authenticated;
