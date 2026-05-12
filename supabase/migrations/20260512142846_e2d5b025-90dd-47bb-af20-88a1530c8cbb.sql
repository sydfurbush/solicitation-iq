ALTER PUBLICATION supabase_realtime ADD TABLE public.documents;
ALTER TABLE public.documents REPLICA IDENTITY FULL;