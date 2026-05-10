CREATE OR REPLACE FUNCTION public.search_document_content(
  p_solicitation_id UUID,
  p_search_term TEXT
)
RETURNS TABLE (
  document_id UUID,
  document_name TEXT,
  section_id UUID,
  section_title TEXT,
  page_number INTEGER,
  snippet TEXT,
  rank REAL
)
LANGUAGE plpgsql
STABLE
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT
    d.id AS document_id,
    d.file_name AS document_name,
    ds.id AS section_id,
    ds.section_title,
    ds.page_start AS page_number,
    ts_headline(
      'english',
      ds.content,
      plainto_tsquery('english', p_search_term),
      'StartSel=<mark>, StopSel=</mark>, MaxWords=50, MinWords=20'
    ) AS snippet,
    ts_rank(
      to_tsvector('english', ds.content),
      plainto_tsquery('english', p_search_term)
    ) AS rank
  FROM public.document_sections ds
  JOIN public.documents d ON d.id = ds.document_id
  WHERE d.solicitation_id = p_solicitation_id
    AND d.deleted_at IS NULL
    AND to_tsvector('english', ds.content) @@ plainto_tsquery('english', p_search_term)
  ORDER BY rank DESC
  LIMIT 50;
END;
$$;

-- Helpful index for full-text search performance
CREATE INDEX IF NOT EXISTS document_sections_content_fts_idx
  ON public.document_sections USING gin (to_tsvector('english', content));