
INSERT INTO storage.buckets (id, name, public)
VALUES ('client-logos', 'client-logos', true)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "client-logos public read"
ON storage.objects FOR SELECT
USING (bucket_id = 'client-logos');

CREATE POLICY "client-logos staff insert"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'client-logos'
  AND public.is_org_staff(auth.uid())
  AND (storage.foldername(name))[1] = public.current_user_org()::text
);

CREATE POLICY "client-logos staff update"
ON storage.objects FOR UPDATE TO authenticated
USING (
  bucket_id = 'client-logos'
  AND public.is_org_staff(auth.uid())
  AND (storage.foldername(name))[1] = public.current_user_org()::text
);

CREATE POLICY "client-logos staff delete"
ON storage.objects FOR DELETE TO authenticated
USING (
  bucket_id = 'client-logos'
  AND public.is_org_staff(auth.uid())
  AND (storage.foldername(name))[1] = public.current_user_org()::text
);
