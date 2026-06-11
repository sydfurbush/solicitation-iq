-- Folders for AI Assistant threads
CREATE TABLE public.assistant_folders (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  organization_id uuid NULL,
  name text NOT NULL,
  color text NULL,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.assistant_folders TO authenticated;
GRANT ALL ON public.assistant_folders TO service_role;

ALTER TABLE public.assistant_folders ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own folders"
  ON public.assistant_folders
  FOR ALL
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE TRIGGER assistant_folders_updated_at
  BEFORE UPDATE ON public.assistant_folders
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- Extend assistant_threads
ALTER TABLE public.assistant_threads
  ADD COLUMN IF NOT EXISTS folder_id uuid NULL REFERENCES public.assistant_folders(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS tags text[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS deleted_at timestamptz NULL;

CREATE INDEX IF NOT EXISTS idx_assistant_threads_folder_id ON public.assistant_threads(folder_id);
CREATE INDEX IF NOT EXISTS idx_assistant_threads_deleted_at ON public.assistant_threads(deleted_at);