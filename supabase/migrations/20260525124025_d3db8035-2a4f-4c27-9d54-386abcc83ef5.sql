
CREATE TYPE public.exhibit_kind AS ENUM (
  'figure','table','chart','exhibit','resume','past_performance','certification','appendix','other'
);
CREATE TYPE public.exhibit_placement AS ENUM ('inline','end_of_section','appendix');
CREATE TYPE public.exhibit_status AS ENUM ('placeholder','in_progress','ready','approved');

CREATE TABLE public.proposal_exhibits (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  solicitation_id uuid NOT NULL,
  organization_id uuid NOT NULL,
  kind public.exhibit_kind NOT NULL DEFAULT 'figure',
  label text,
  title text NOT NULL,
  caption text,
  description text,
  outline_node_id uuid,
  appendix_code text,
  placement public.exhibit_placement NOT NULL DEFAULT 'inline',
  sort_order integer NOT NULL DEFAULT 0,
  file_path text,
  file_name text,
  file_type text,
  file_size integer,
  preview_image_path text,
  status public.exhibit_status NOT NULL DEFAULT 'placeholder',
  owner_user_id uuid,
  due_date date,
  notes text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_proposal_exhibits_sol ON public.proposal_exhibits(solicitation_id);
CREATE INDEX idx_proposal_exhibits_node ON public.proposal_exhibits(outline_node_id);

ALTER TABLE public.proposal_exhibits ENABLE ROW LEVEL SECURITY;

CREATE POLICY "staff manage proposal_exhibits"
ON public.proposal_exhibits FOR ALL TO public
USING (public.is_solicitation_member(auth.uid(), solicitation_id))
WITH CHECK (public.is_solicitation_member(auth.uid(), solicitation_id));

CREATE POLICY "view proposal_exhibits"
ON public.proposal_exhibits FOR SELECT TO public
USING (public.is_solicitation_member(auth.uid(), solicitation_id));

CREATE POLICY "client user view exhibits"
ON public.proposal_exhibits FOR SELECT TO authenticated
USING (solicitation_id IN (
  SELECT s.id FROM solicitations s JOIN clients c ON c.id = s.client_id
  WHERE c.id = current_client_id() AND c.access_level = 'full'::client_access_level
));

CREATE TRIGGER update_proposal_exhibits_updated_at
BEFORE UPDATE ON public.proposal_exhibits
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

ALTER TABLE public.solicitations
  ADD COLUMN IF NOT EXISTS compile_appendix_volume boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS appendix_volume_name text NOT NULL DEFAULT 'Appendix';

INSERT INTO storage.buckets (id, name, public)
VALUES ('proposal-exhibits', 'proposal-exhibits', false)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "staff read exhibits files"
ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'proposal-exhibits' AND public.is_org_staff(auth.uid()));

CREATE POLICY "staff insert exhibits files"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'proposal-exhibits' AND public.is_org_staff(auth.uid()));

CREATE POLICY "staff update exhibits files"
ON storage.objects FOR UPDATE TO authenticated
USING (bucket_id = 'proposal-exhibits' AND public.is_org_staff(auth.uid()));

CREATE POLICY "staff delete exhibits files"
ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'proposal-exhibits' AND public.is_org_staff(auth.uid()));
