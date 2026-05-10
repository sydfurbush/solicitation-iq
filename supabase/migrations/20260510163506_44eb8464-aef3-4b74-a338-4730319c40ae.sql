-- Create private bucket for solicitation documents
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'solicitation-documents',
  'solicitation-documents',
  false,
  52428800,
  ARRAY[
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/vnd.ms-powerpoint',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    'text/plain',
    'text/csv'
  ]
)
ON CONFLICT (id) DO UPDATE SET
  public = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

-- Helper: org id from path (first folder segment)
-- Path layout: {organization_id}/{client_id}/{solicitation_id}/{document_id}/{filename}

CREATE POLICY "view org solicitation documents"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'solicitation-documents'
  AND (storage.foldername(name))[1] = public.current_user_org()::text
);

CREATE POLICY "staff upload solicitation documents"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'solicitation-documents'
  AND public.is_org_staff(auth.uid())
  AND (storage.foldername(name))[1] = public.current_user_org()::text
);

CREATE POLICY "staff update solicitation documents"
ON storage.objects FOR UPDATE
TO authenticated
USING (
  bucket_id = 'solicitation-documents'
  AND public.is_org_staff(auth.uid())
  AND (storage.foldername(name))[1] = public.current_user_org()::text
)
WITH CHECK (
  bucket_id = 'solicitation-documents'
  AND public.is_org_staff(auth.uid())
  AND (storage.foldername(name))[1] = public.current_user_org()::text
);

CREATE POLICY "staff delete solicitation documents"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'solicitation-documents'
  AND public.is_org_staff(auth.uid())
  AND (storage.foldername(name))[1] = public.current_user_org()::text
);