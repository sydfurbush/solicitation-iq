
CREATE POLICY "Users upload own assistant attachments"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'assistant-attachments'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

CREATE POLICY "Users read own assistant attachments"
  ON storage.objects FOR SELECT
  USING (
    bucket_id = 'assistant-attachments'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

CREATE POLICY "Users delete own assistant attachments"
  ON storage.objects FOR DELETE
  USING (
    bucket_id = 'assistant-attachments'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

ALTER TABLE public.assistant_attachments
  ADD COLUMN IF NOT EXISTS kind text NOT NULL DEFAULT 'doc'
    CHECK (kind IN ('photo','doc'));
