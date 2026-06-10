
-- 1. Table
CREATE TABLE IF NOT EXISTS public.document_chunks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id uuid NOT NULL REFERENCES public.documents(id) ON DELETE CASCADE,
  solicitation_id uuid NOT NULL REFERENCES public.solicitations(id) ON DELETE CASCADE,
  section_id uuid REFERENCES public.document_sections(id) ON DELETE SET NULL,
  chunk_index integer NOT NULL,
  content text NOT NULL,
  page_number integer,
  token_estimate integer,
  embedding vector(768),
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- 2. Grants (auth-scoped via RLS; service_role for edge functions)
GRANT SELECT, INSERT, UPDATE, DELETE ON public.document_chunks TO authenticated;
GRANT ALL ON public.document_chunks TO service_role;

-- 3. RLS
ALTER TABLE public.document_chunks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members can view document chunks"
  ON public.document_chunks FOR SELECT
  TO authenticated
  USING (public.is_solicitation_member(auth.uid(), solicitation_id));

CREATE POLICY "Admins can manage document chunks"
  ON public.document_chunks FOR ALL
  TO authenticated
  USING (public.is_solicitation_admin(auth.uid(), solicitation_id))
  WITH CHECK (public.is_solicitation_admin(auth.uid(), solicitation_id));

-- 4. Indexes
CREATE INDEX IF NOT EXISTS document_chunks_solicitation_idx
  ON public.document_chunks (solicitation_id);
CREATE INDEX IF NOT EXISTS document_chunks_document_idx
  ON public.document_chunks (document_id);
CREATE INDEX IF NOT EXISTS document_chunks_embedding_idx
  ON public.document_chunks USING hnsw (embedding vector_cosine_ops);

-- 5. Similarity-search function
CREATE OR REPLACE FUNCTION public.match_document_chunks(
  p_solicitation_id uuid,
  p_query_embedding vector,
  p_match_count integer DEFAULT 8,
  p_min_similarity real DEFAULT 0.25
)
RETURNS TABLE(
  chunk_id uuid,
  document_id uuid,
  document_name text,
  section_id uuid,
  section_title text,
  page_number integer,
  chunk_index integer,
  content text,
  similarity real
)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT
    c.id AS chunk_id,
    c.document_id,
    d.file_name AS document_name,
    c.section_id,
    ds.section_title,
    c.page_number,
    c.chunk_index,
    c.content,
    1 - (c.embedding <=> p_query_embedding) AS similarity
  FROM public.document_chunks c
  JOIN public.documents d ON d.id = c.document_id
  LEFT JOIN public.document_sections ds ON ds.id = c.section_id
  WHERE c.solicitation_id = p_solicitation_id
    AND c.embedding IS NOT NULL
    AND d.deleted_at IS NULL
    AND 1 - (c.embedding <=> p_query_embedding) >= p_min_similarity
  ORDER BY c.embedding <=> p_query_embedding
  LIMIT p_match_count;
$$;
