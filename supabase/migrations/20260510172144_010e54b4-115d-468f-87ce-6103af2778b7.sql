INSERT INTO storage.buckets (id, name, public, file_size_limit)
VALUES ('reports', 'reports', false, 52428800)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "view org reports"
ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'reports'
  AND EXISTS (
    SELECT 1 FROM public.solicitations s
    JOIN public.clients c ON c.id = s.client_id
    WHERE c.organization_id = public.current_user_org()
      AND s.id::text = (storage.foldername(name))[1]
  )
);

CREATE POLICY "staff upload reports"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'reports'
  AND public.is_org_staff(auth.uid())
);

CREATE POLICY "staff update reports"
ON storage.objects FOR UPDATE TO authenticated
USING (bucket_id = 'reports' AND public.is_org_staff(auth.uid()));

CREATE POLICY "staff delete reports"
ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'reports' AND public.is_org_staff(auth.uid()));