
CREATE POLICY "assistant uploads read" ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'assistant-uploads'
    AND public.is_org_staff(auth.uid())
  );

CREATE POLICY "assistant uploads insert" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'assistant-uploads'
    AND public.is_org_staff(auth.uid())
    AND owner = auth.uid()
  );

CREATE POLICY "assistant uploads delete own" ON storage.objects
  FOR DELETE TO authenticated
  USING (
    bucket_id = 'assistant-uploads'
    AND owner = auth.uid()
  );
