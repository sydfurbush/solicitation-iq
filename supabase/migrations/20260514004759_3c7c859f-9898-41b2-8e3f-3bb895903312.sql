-- ---------- Enum extensions ----------
ALTER TYPE phase_type ADD VALUE IF NOT EXISTS 'phase_5_drafting';

ALTER TYPE writing_status ADD VALUE IF NOT EXISTS 'pink_review';
ALTER TYPE writing_status ADD VALUE IF NOT EXISTS 'red_review';
ALTER TYPE writing_status ADD VALUE IF NOT EXISTS 'gold_review';

-- ---------- proposal_drafts ----------
CREATE TABLE public.proposal_drafts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  outline_node_id uuid NOT NULL UNIQUE,
  solicitation_id uuid NOT NULL,
  content_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  content_html text NOT NULL DEFAULT '',
  word_count integer NOT NULL DEFAULT 0,
  page_estimate numeric NOT NULL DEFAULT 0,
  last_ai_action text,
  updated_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_proposal_drafts_sol ON public.proposal_drafts(solicitation_id);
ALTER TABLE public.proposal_drafts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "view proposal drafts"
ON public.proposal_drafts FOR SELECT TO authenticated
USING (solicitation_id IN (
  SELECT s.id FROM solicitations s JOIN clients c ON c.id = s.client_id
  WHERE c.organization_id = current_user_org()
));

CREATE POLICY "staff manage proposal drafts"
ON public.proposal_drafts FOR ALL TO authenticated
USING (is_org_staff(auth.uid()) AND solicitation_id IN (
  SELECT s.id FROM solicitations s JOIN clients c ON c.id = s.client_id
  WHERE c.organization_id = current_user_org()
))
WITH CHECK (is_org_staff(auth.uid()) AND solicitation_id IN (
  SELECT s.id FROM solicitations s JOIN clients c ON c.id = s.client_id
  WHERE c.organization_id = current_user_org()
));

CREATE TRIGGER trg_proposal_drafts_updated_at
BEFORE UPDATE ON public.proposal_drafts
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- ---------- proposal_draft_versions ----------
CREATE TABLE public.proposal_draft_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  draft_id uuid NOT NULL,
  solicitation_id uuid NOT NULL,
  content_json jsonb NOT NULL,
  word_count integer NOT NULL DEFAULT 0,
  change_summary text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_pdv_draft ON public.proposal_draft_versions(draft_id, created_at DESC);
ALTER TABLE public.proposal_draft_versions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "view draft versions"
ON public.proposal_draft_versions FOR SELECT TO authenticated
USING (solicitation_id IN (
  SELECT s.id FROM solicitations s JOIN clients c ON c.id = s.client_id
  WHERE c.organization_id = current_user_org()
));

CREATE POLICY "staff insert draft versions"
ON public.proposal_draft_versions FOR INSERT TO authenticated
WITH CHECK (is_org_staff(auth.uid()) AND solicitation_id IN (
  SELECT s.id FROM solicitations s JOIN clients c ON c.id = s.client_id
  WHERE c.organization_id = current_user_org()
));

-- ---------- proposal_draft_comments ----------
CREATE TABLE public.proposal_draft_comments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  draft_id uuid NOT NULL,
  solicitation_id uuid NOT NULL,
  parent_id uuid,
  range_start integer,
  range_end integer,
  quoted_text text,
  body text NOT NULL,
  team text NOT NULL DEFAULT 'pink',
  status text NOT NULL DEFAULT 'open',
  author_id uuid,
  resolved_by uuid,
  resolved_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT pdc_team_chk CHECK (team IN ('pink','red','gold')),
  CONSTRAINT pdc_status_chk CHECK (status IN ('open','resolved'))
);
CREATE INDEX idx_pdc_draft ON public.proposal_draft_comments(draft_id);
ALTER TABLE public.proposal_draft_comments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "view draft comments"
ON public.proposal_draft_comments FOR SELECT TO authenticated
USING (solicitation_id IN (
  SELECT s.id FROM solicitations s JOIN clients c ON c.id = s.client_id
  WHERE c.organization_id = current_user_org()
));

CREATE POLICY "staff manage draft comments"
ON public.proposal_draft_comments FOR ALL TO authenticated
USING (is_org_staff(auth.uid()) AND solicitation_id IN (
  SELECT s.id FROM solicitations s JOIN clients c ON c.id = s.client_id
  WHERE c.organization_id = current_user_org()
))
WITH CHECK (is_org_staff(auth.uid()) AND solicitation_id IN (
  SELECT s.id FROM solicitations s JOIN clients c ON c.id = s.client_id
  WHERE c.organization_id = current_user_org()
));

CREATE TRIGGER trg_pdc_updated_at
BEFORE UPDATE ON public.proposal_draft_comments
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- ---------- proposal_packages ----------
CREATE TABLE public.proposal_packages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  solicitation_id uuid NOT NULL,
  kind text NOT NULL,
  volume text,
  storage_path text NOT NULL,
  byte_size integer,
  checksum text,
  generated_by uuid,
  pre_flight_pass boolean NOT NULL DEFAULT false,
  pre_flight_report jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT pp_kind_chk CHECK (kind IN ('volume_docx','volume_pdf','compliance_matrix','zip','cover_letter','transmittal'))
);
CREATE INDEX idx_pp_sol ON public.proposal_packages(solicitation_id, created_at DESC);
ALTER TABLE public.proposal_packages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "view proposal packages"
ON public.proposal_packages FOR SELECT TO authenticated
USING (solicitation_id IN (
  SELECT s.id FROM solicitations s JOIN clients c ON c.id = s.client_id
  WHERE c.organization_id = current_user_org()
));

CREATE POLICY "staff manage proposal packages"
ON public.proposal_packages FOR ALL TO authenticated
USING (is_org_staff(auth.uid()) AND solicitation_id IN (
  SELECT s.id FROM solicitations s JOIN clients c ON c.id = s.client_id
  WHERE c.organization_id = current_user_org()
))
WITH CHECK (is_org_staff(auth.uid()) AND solicitation_id IN (
  SELECT s.id FROM solicitations s JOIN clients c ON c.id = s.client_id
  WHERE c.organization_id = current_user_org()
));

-- ---------- buyer_format_profiles ----------
CREATE TABLE public.buyer_format_profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL,
  name text NOT NULL,
  is_default boolean NOT NULL DEFAULT false,
  vertical text NOT NULL DEFAULT 'federal',
  font text NOT NULL DEFAULT 'Times New Roman',
  size_pt numeric NOT NULL DEFAULT 12,
  margins_in numeric NOT NULL DEFAULT 1.0,
  line_spacing numeric NOT NULL DEFAULT 1.0,
  header_html text,
  footer_html text,
  page_number_format text NOT NULL DEFAULT '{volume} - {page} of {pages}',
  volume_page_limits jsonb NOT NULL DEFAULT '{}'::jsonb,
  file_name_pattern text NOT NULL DEFAULT '{firm}_{solnumber}_{volume}',
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT bfp_vertical_chk CHECK (vertical IN ('federal','utility','commercial'))
);
CREATE INDEX idx_bfp_org ON public.buyer_format_profiles(organization_id);
ALTER TABLE public.buyer_format_profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "view org format profiles"
ON public.buyer_format_profiles FOR SELECT TO authenticated
USING (organization_id = current_user_org());

CREATE POLICY "staff manage format profiles"
ON public.buyer_format_profiles FOR ALL TO authenticated
USING (is_org_staff(auth.uid()) AND organization_id = current_user_org())
WITH CHECK (is_org_staff(auth.uid()) AND organization_id = current_user_org());

CREATE TRIGGER trg_bfp_updated_at
BEFORE UPDATE ON public.buyer_format_profiles
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- Optional: link a solicitation to a chosen format profile.
ALTER TABLE public.solicitations ADD COLUMN IF NOT EXISTS format_profile_id uuid;