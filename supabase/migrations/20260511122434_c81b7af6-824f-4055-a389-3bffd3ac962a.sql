CREATE TABLE public.prior_import_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  prior_link_id uuid NOT NULL,
  prior_solicitation_id uuid,
  source text NOT NULL DEFAULT 'sam',
  action text NOT NULL DEFAULT 'initial',
  status text NOT NULL DEFAULT 'success',
  found_count integer NOT NULL DEFAULT 0,
  imported_count integer NOT NULL DEFAULT 0,
  failed_count integer NOT NULL DEFAULT 0,
  failed_attachments jsonb NOT NULL DEFAULT '[]'::jsonb,
  error_message text,
  started_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz,
  performed_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_prior_import_history_link ON public.prior_import_history(prior_link_id, started_at DESC);

ALTER TABLE public.prior_import_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "staff manage prior import history"
  ON public.prior_import_history
  FOR ALL
  TO authenticated
  USING (
    is_org_staff(auth.uid())
    AND prior_link_id IN (
      SELECT ps.id FROM public.prior_solicitations ps
      JOIN public.solicitations s ON s.id = ps.solicitation_id
      JOIN public.clients c ON c.id = s.client_id
      WHERE c.organization_id = current_user_org()
    )
  )
  WITH CHECK (
    is_org_staff(auth.uid())
    AND prior_link_id IN (
      SELECT ps.id FROM public.prior_solicitations ps
      JOIN public.solicitations s ON s.id = ps.solicitation_id
      JOIN public.clients c ON c.id = s.client_id
      WHERE c.organization_id = current_user_org()
    )
  );

CREATE POLICY "view prior import history"
  ON public.prior_import_history
  FOR SELECT
  TO authenticated
  USING (
    prior_link_id IN (
      SELECT ps.id FROM public.prior_solicitations ps
      JOIN public.solicitations s ON s.id = ps.solicitation_id
      JOIN public.clients c ON c.id = s.client_id
      WHERE c.organization_id = current_user_org()
    )
  );