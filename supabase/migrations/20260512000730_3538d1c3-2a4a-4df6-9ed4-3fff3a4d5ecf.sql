
CREATE TABLE public.export_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  solicitation_id uuid NOT NULL,
  organization_id uuid NOT NULL,
  kind text NOT NULL,
  format text NOT NULL,
  filename text NOT NULL,
  file_path text NOT NULL,
  file_size integer,
  version text,
  page_size text,
  sections jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_export_history_solicitation ON public.export_history(solicitation_id, created_at DESC);

ALTER TABLE public.export_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "view org export history"
ON public.export_history FOR SELECT TO authenticated
USING (
  solicitation_id IN (
    SELECT s.id FROM public.solicitations s
    JOIN public.clients c ON c.id = s.client_id
    WHERE c.organization_id = public.current_user_org()
  )
);

CREATE POLICY "staff insert export history"
ON public.export_history FOR INSERT TO authenticated
WITH CHECK (
  public.is_org_staff(auth.uid())
  AND organization_id = public.current_user_org()
  AND solicitation_id IN (
    SELECT s.id FROM public.solicitations s
    JOIN public.clients c ON c.id = s.client_id
    WHERE c.organization_id = public.current_user_org()
  )
);
