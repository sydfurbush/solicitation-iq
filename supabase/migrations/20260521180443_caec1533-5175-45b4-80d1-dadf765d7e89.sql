
-- Enums for teaming
CREATE TYPE public.teaming_role AS ENUM ('prime','sub','teaming','mentor_protege');
CREATE TYPE public.teaming_agreement_status AS ENUM ('none','nda','ta','loi','subcontract');

-- Partners
CREATE TABLE public.solicitation_teaming_partners (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  solicitation_id uuid NOT NULL,
  linked_client_id uuid NULL,
  name text NOT NULL,
  role public.teaming_role NOT NULL DEFAULT 'sub',
  set_asides text[] NOT NULL DEFAULT '{}',
  naics_codes text[] NOT NULL DEFAULT '{}',
  workshare_pct numeric(5,2) NULL,
  scope_summary text NULL,
  agreement_status public.teaming_agreement_status NOT NULL DEFAULT 'none',
  poc_name text NULL,
  poc_email text NULL,
  poc_phone text NULL,
  clearance_level text NULL,
  cleared_staff_count integer NULL,
  notes text NULL,
  sort_order integer NOT NULL DEFAULT 0,
  created_by uuid NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_stp_solicitation ON public.solicitation_teaming_partners(solicitation_id);

ALTER TABLE public.solicitation_teaming_partners ENABLE ROW LEVEL SECURITY;

CREATE POLICY "staff manage teaming partners"
  ON public.solicitation_teaming_partners FOR ALL
  USING (public.is_solicitation_member(auth.uid(), solicitation_id))
  WITH CHECK (public.is_solicitation_member(auth.uid(), solicitation_id));

CREATE POLICY "client user view teaming partners"
  ON public.solicitation_teaming_partners FOR SELECT
  TO authenticated
  USING (solicitation_id IN (
    SELECT s.id FROM solicitations s
    JOIN clients c ON c.id = s.client_id
    WHERE c.id = public.current_client_id() AND c.access_level = 'full'::client_access_level
  ));

-- Validation trigger for workshare 0..100
CREATE OR REPLACE FUNCTION public.validate_teaming_partner()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
BEGIN
  IF NEW.workshare_pct IS NOT NULL AND (NEW.workshare_pct < 0 OR NEW.workshare_pct > 100) THEN
    RAISE EXCEPTION 'workshare_pct must be between 0 and 100';
  END IF;
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_validate_teaming_partner
BEFORE INSERT OR UPDATE ON public.solicitation_teaming_partners
FOR EACH ROW EXECUTE FUNCTION public.validate_teaming_partner();

-- Attachments
CREATE TABLE public.solicitation_teaming_attachments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  partner_id uuid NOT NULL REFERENCES public.solicitation_teaming_partners(id) ON DELETE CASCADE,
  solicitation_id uuid NOT NULL,
  file_path text NOT NULL,
  file_name text NOT NULL,
  mime_type text NULL,
  byte_size integer NULL,
  uploaded_by uuid NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_sta_partner ON public.solicitation_teaming_attachments(partner_id);
CREATE INDEX idx_sta_solicitation ON public.solicitation_teaming_attachments(solicitation_id);

ALTER TABLE public.solicitation_teaming_attachments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "staff manage teaming attachments"
  ON public.solicitation_teaming_attachments FOR ALL
  USING (public.is_solicitation_member(auth.uid(), solicitation_id))
  WITH CHECK (public.is_solicitation_member(auth.uid(), solicitation_id));

CREATE POLICY "client view teaming attachments"
  ON public.solicitation_teaming_attachments FOR SELECT
  TO authenticated
  USING (solicitation_id IN (
    SELECT s.id FROM solicitations s
    JOIN clients c ON c.id = s.client_id
    WHERE c.id = public.current_client_id() AND c.access_level = 'full'::client_access_level
  ));
