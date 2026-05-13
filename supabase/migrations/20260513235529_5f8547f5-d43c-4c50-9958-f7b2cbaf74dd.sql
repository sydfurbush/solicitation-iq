-- Enable pgvector
CREATE EXTENSION IF NOT EXISTS vector;

-- Documents (one per uploaded file or pasted note)
CREATE TABLE public.client_knowledge_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL,
  title text NOT NULL,
  source_type text NOT NULL CHECK (source_type IN ('note','upload')),
  file_path text,
  mime_type text,
  byte_size integer,
  raw_text text,
  tags text[] NOT NULL DEFAULT '{}',
  source_url text,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','embedding','ready','failed')),
  error text,
  chunk_count integer NOT NULL DEFAULT 0,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_ckd_client ON public.client_knowledge_documents(client_id);
CREATE INDEX idx_ckd_status ON public.client_knowledge_documents(status);

ALTER TABLE public.client_knowledge_documents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "staff manage client knowledge documents"
ON public.client_knowledge_documents FOR ALL TO authenticated
USING (is_org_staff(auth.uid()) AND client_id IN (SELECT id FROM public.clients WHERE organization_id = current_user_org()))
WITH CHECK (is_org_staff(auth.uid()) AND client_id IN (SELECT id FROM public.clients WHERE organization_id = current_user_org()));

CREATE POLICY "view org client knowledge documents"
ON public.client_knowledge_documents FOR SELECT TO authenticated
USING (client_id IN (SELECT id FROM public.clients WHERE organization_id = current_user_org()));

CREATE POLICY "client user view own knowledge documents"
ON public.client_knowledge_documents FOR SELECT TO authenticated
USING (client_id = current_client_id());

CREATE TRIGGER trg_ckd_updated_at BEFORE UPDATE ON public.client_knowledge_documents
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- Chunks
CREATE TABLE public.client_knowledge_chunks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id uuid NOT NULL REFERENCES public.client_knowledge_documents(id) ON DELETE CASCADE,
  client_id uuid NOT NULL,
  chunk_index integer NOT NULL,
  content text NOT NULL,
  token_estimate integer,
  embedding vector(768),
  metadata jsonb NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_ckc_document ON public.client_knowledge_chunks(document_id);
CREATE INDEX idx_ckc_client ON public.client_knowledge_chunks(client_id);
CREATE INDEX idx_ckc_embedding ON public.client_knowledge_chunks USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);

ALTER TABLE public.client_knowledge_chunks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "staff manage client knowledge chunks"
ON public.client_knowledge_chunks FOR ALL TO authenticated
USING (is_org_staff(auth.uid()) AND client_id IN (SELECT id FROM public.clients WHERE organization_id = current_user_org()))
WITH CHECK (is_org_staff(auth.uid()) AND client_id IN (SELECT id FROM public.clients WHERE organization_id = current_user_org()));

CREATE POLICY "view org client knowledge chunks"
ON public.client_knowledge_chunks FOR SELECT TO authenticated
USING (client_id IN (SELECT id FROM public.clients WHERE organization_id = current_user_org()));

-- Match function (similarity search, scoped to a client)
CREATE OR REPLACE FUNCTION public.match_client_knowledge(
  p_client_id uuid,
  p_query_embedding vector(768),
  p_match_count integer DEFAULT 5,
  p_min_similarity real DEFAULT 0.3
)
RETURNS TABLE (
  chunk_id uuid,
  document_id uuid,
  document_title text,
  chunk_index integer,
  content text,
  similarity real,
  source_type text,
  tags text[],
  source_url text
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT
    c.id AS chunk_id,
    c.document_id,
    d.title AS document_title,
    c.chunk_index,
    c.content,
    1 - (c.embedding <=> p_query_embedding) AS similarity,
    d.source_type,
    d.tags,
    d.source_url
  FROM public.client_knowledge_chunks c
  JOIN public.client_knowledge_documents d ON d.id = c.document_id
  WHERE c.client_id = p_client_id
    AND c.embedding IS NOT NULL
    AND d.status = 'ready'
    AND 1 - (c.embedding <=> p_query_embedding) >= p_min_similarity
  ORDER BY c.embedding <=> p_query_embedding
  LIMIT p_match_count;
$$;

-- Storage bucket (private)
INSERT INTO storage.buckets (id, name, public)
VALUES ('client-knowledge', 'client-knowledge', false)
ON CONFLICT (id) DO NOTHING;

-- Storage policies: org staff manage objects scoped by first folder = client_id
CREATE POLICY "staff manage client knowledge files"
ON storage.objects FOR ALL TO authenticated
USING (
  bucket_id = 'client-knowledge'
  AND is_org_staff(auth.uid())
  AND (storage.foldername(name))[1]::uuid IN (
    SELECT id FROM public.clients WHERE organization_id = current_user_org()
  )
)
WITH CHECK (
  bucket_id = 'client-knowledge'
  AND is_org_staff(auth.uid())
  AND (storage.foldername(name))[1]::uuid IN (
    SELECT id FROM public.clients WHERE organization_id = current_user_org()
  )
);

CREATE POLICY "view org client knowledge files"
ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'client-knowledge'
  AND (storage.foldername(name))[1]::uuid IN (
    SELECT id FROM public.clients WHERE organization_id = current_user_org()
  )
);
