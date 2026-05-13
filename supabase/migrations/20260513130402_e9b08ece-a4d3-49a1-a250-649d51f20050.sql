
-- Phase 3: read/reviewed state for revisions and documents
CREATE TABLE public.revision_reviews (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  revision_id uuid NOT NULL REFERENCES public.solicitation_revisions(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  reviewed_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (revision_id, user_id)
);

ALTER TABLE public.revision_reviews ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users manage own revision reviews"
  ON public.revision_reviews
  FOR ALL
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "org staff view revision reviews"
  ON public.revision_reviews
  FOR SELECT
  TO authenticated
  USING (
    revision_id IN (
      SELECT r.id FROM public.solicitation_revisions r
      JOIN public.solicitations s ON s.id = r.solicitation_id
      JOIN public.clients c ON c.id = s.client_id
      WHERE c.organization_id = current_user_org()
    )
  );

CREATE INDEX idx_revision_reviews_user ON public.revision_reviews(user_id);
CREATE INDEX idx_revision_reviews_revision ON public.revision_reviews(revision_id);

CREATE TABLE public.document_reviews (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id uuid NOT NULL REFERENCES public.documents(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  reviewed_revision_id uuid REFERENCES public.solicitation_revisions(id) ON DELETE SET NULL,
  reviewed_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (document_id, user_id)
);

ALTER TABLE public.document_reviews ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users manage own document reviews"
  ON public.document_reviews
  FOR ALL
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE INDEX idx_document_reviews_user ON public.document_reviews(user_id);
CREATE INDEX idx_document_reviews_doc ON public.document_reviews(document_id);
