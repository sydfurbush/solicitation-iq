ALTER TABLE public.client_onboarding_documents
  ADD COLUMN received_via text NOT NULL DEFAULT 'portal' CHECK (received_via IN ('portal','email','other')),
  ADD COLUMN received_from text,
  ADD COLUMN received_on date;
UPDATE public.client_onboarding_documents SET received_via = CASE WHEN uploaded_by_kind = 'staff' THEN 'other' ELSE 'portal' END;
DROP POLICY "Clients insert own onboarding docs" ON public.client_onboarding_documents;
CREATE POLICY "Clients insert own onboarding docs" ON public.client_onboarding_documents FOR INSERT TO authenticated
  WITH CHECK (public.is_client_user(auth.uid()) AND client_id = public.current_client_id() AND uploaded_by = auth.uid() AND uploaded_by_kind = 'client' AND status = 'uploaded' AND received_via = 'portal');
CREATE POLICY "Clients delete own untriaged onboarding files" ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'client-onboarding' AND public.is_client_user(auth.uid())
    AND (storage.foldername(name))[1] = public.current_client_id()::text
    AND EXISTS (SELECT 1 FROM public.client_onboarding_documents d
      WHERE d.file_path = storage.objects.name AND d.uploaded_by = auth.uid() AND d.status <> 'triaged'));