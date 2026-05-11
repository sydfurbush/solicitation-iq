
-- ============ ENUMS ============
CREATE TYPE public.requirement_status AS ENUM ('open','in_review','covered','waived');
CREATE TYPE public.gap_type AS ENUM ('capability','past_performance','certification','teaming','other');
CREATE TYPE public.gap_severity AS ENUM ('low','medium','high','critical');
CREATE TYPE public.gap_recommendation AS ENUM ('build','buy','team','no_bid','accept');
CREATE TYPE public.win_theme_status AS ENUM ('draft','approved','rejected');

-- ============ REQUIREMENT_ITEMS (RTM) ============
CREATE TABLE public.requirement_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  solicitation_id UUID NOT NULL,
  req_number TEXT NOT NULL,
  shall_text TEXT NOT NULL,
  source_section TEXT,
  source_document_id UUID,
  page_number INTEGER,
  source_quote TEXT,
  source_citation TEXT,
  compliance_owner TEXT,
  proposal_volume TEXT,
  proposal_section TEXT,
  status public.requirement_status NOT NULL DEFAULT 'open',
  notes TEXT,
  is_ai_generated BOOLEAN NOT NULL DEFAULT true,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_requirement_items_sol ON public.requirement_items(solicitation_id);
ALTER TABLE public.requirement_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "staff manage requirement items" ON public.requirement_items
  FOR ALL TO authenticated
  USING (is_org_staff(auth.uid()) AND solicitation_id IN (
    SELECT s.id FROM solicitations s JOIN clients c ON c.id = s.client_id
    WHERE c.organization_id = current_user_org()
  ))
  WITH CHECK (is_org_staff(auth.uid()) AND solicitation_id IN (
    SELECT s.id FROM solicitations s JOIN clients c ON c.id = s.client_id
    WHERE c.organization_id = current_user_org()
  ));
CREATE POLICY "view requirement items" ON public.requirement_items
  FOR SELECT TO authenticated
  USING (solicitation_id IN (
    SELECT s.id FROM solicitations s JOIN clients c ON c.id = s.client_id
    WHERE c.organization_id = current_user_org()
  ));

CREATE TRIGGER requirement_items_updated BEFORE UPDATE ON public.requirement_items
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- ============ SECTION_ANALYSES ============
CREATE TABLE public.section_analyses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  solicitation_id UUID NOT NULL,
  section_code TEXT NOT NULL,
  section_title TEXT,
  summary TEXT,
  requirements_count INTEGER DEFAULT 0,
  scoring_weight NUMERIC,
  risk_flags JSONB NOT NULL DEFAULT '[]'::jsonb,
  source_citations JSONB NOT NULL DEFAULT '[]'::jsonb,
  is_ai_generated BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (solicitation_id, section_code)
);
CREATE INDEX idx_section_analyses_sol ON public.section_analyses(solicitation_id);
ALTER TABLE public.section_analyses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "staff manage section analyses" ON public.section_analyses
  FOR ALL TO authenticated
  USING (is_org_staff(auth.uid()) AND solicitation_id IN (
    SELECT s.id FROM solicitations s JOIN clients c ON c.id = s.client_id
    WHERE c.organization_id = current_user_org()
  ))
  WITH CHECK (is_org_staff(auth.uid()) AND solicitation_id IN (
    SELECT s.id FROM solicitations s JOIN clients c ON c.id = s.client_id
    WHERE c.organization_id = current_user_org()
  ));
CREATE POLICY "view section analyses" ON public.section_analyses
  FOR SELECT TO authenticated
  USING (solicitation_id IN (
    SELECT s.id FROM solicitations s JOIN clients c ON c.id = s.client_id
    WHERE c.organization_id = current_user_org()
  ));
CREATE TRIGGER section_analyses_updated BEFORE UPDATE ON public.section_analyses
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- ============ CAPABILITY_GAPS ============
CREATE TABLE public.capability_gaps (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  solicitation_id UUID NOT NULL,
  requirement_id UUID,
  gap_type public.gap_type NOT NULL DEFAULT 'capability',
  severity public.gap_severity NOT NULL DEFAULT 'medium',
  title TEXT NOT NULL,
  description TEXT,
  recommendation public.gap_recommendation,
  client_note TEXT,
  is_resolved BOOLEAN NOT NULL DEFAULT false,
  is_ai_generated BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_capability_gaps_sol ON public.capability_gaps(solicitation_id);
ALTER TABLE public.capability_gaps ENABLE ROW LEVEL SECURITY;

CREATE POLICY "staff manage capability gaps" ON public.capability_gaps
  FOR ALL TO authenticated
  USING (is_org_staff(auth.uid()) AND solicitation_id IN (
    SELECT s.id FROM solicitations s JOIN clients c ON c.id = s.client_id
    WHERE c.organization_id = current_user_org()
  ))
  WITH CHECK (is_org_staff(auth.uid()) AND solicitation_id IN (
    SELECT s.id FROM solicitations s JOIN clients c ON c.id = s.client_id
    WHERE c.organization_id = current_user_org()
  ));
CREATE POLICY "view capability gaps" ON public.capability_gaps
  FOR SELECT TO authenticated
  USING (solicitation_id IN (
    SELECT s.id FROM solicitations s JOIN clients c ON c.id = s.client_id
    WHERE c.organization_id = current_user_org()
  ));
CREATE TRIGGER capability_gaps_updated BEFORE UPDATE ON public.capability_gaps
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- ============ PROPOSAL_OUTLINES ============
CREATE TABLE public.proposal_outlines (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  solicitation_id UUID NOT NULL,
  version INTEGER NOT NULL DEFAULT 1,
  title TEXT NOT NULL DEFAULT 'Proposal Outline',
  is_active BOOLEAN NOT NULL DEFAULT true,
  generated_at TIMESTAMPTZ DEFAULT now(),
  generated_by UUID,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_proposal_outlines_sol ON public.proposal_outlines(solicitation_id);
ALTER TABLE public.proposal_outlines ENABLE ROW LEVEL SECURITY;

CREATE POLICY "staff manage proposal outlines" ON public.proposal_outlines
  FOR ALL TO authenticated
  USING (is_org_staff(auth.uid()) AND solicitation_id IN (
    SELECT s.id FROM solicitations s JOIN clients c ON c.id = s.client_id
    WHERE c.organization_id = current_user_org()
  ))
  WITH CHECK (is_org_staff(auth.uid()) AND solicitation_id IN (
    SELECT s.id FROM solicitations s JOIN clients c ON c.id = s.client_id
    WHERE c.organization_id = current_user_org()
  ));
CREATE POLICY "view proposal outlines" ON public.proposal_outlines
  FOR SELECT TO authenticated
  USING (solicitation_id IN (
    SELECT s.id FROM solicitations s JOIN clients c ON c.id = s.client_id
    WHERE c.organization_id = current_user_org()
  ));
CREATE TRIGGER proposal_outlines_updated BEFORE UPDATE ON public.proposal_outlines
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- ============ OUTLINE_NODES ============
CREATE TABLE public.outline_nodes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  outline_id UUID NOT NULL REFERENCES public.proposal_outlines(id) ON DELETE CASCADE,
  parent_id UUID REFERENCES public.outline_nodes(id) ON DELETE CASCADE,
  sort_order INTEGER NOT NULL DEFAULT 0,
  volume TEXT,
  section_number TEXT,
  title TEXT NOT NULL,
  page_allocation INTEGER,
  assigned_to UUID,
  source_l_reference TEXT,
  linked_requirement_ids UUID[] NOT NULL DEFAULT '{}'::uuid[],
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_outline_nodes_outline ON public.outline_nodes(outline_id);
CREATE INDEX idx_outline_nodes_parent ON public.outline_nodes(parent_id);
ALTER TABLE public.outline_nodes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "staff manage outline nodes" ON public.outline_nodes
  FOR ALL TO authenticated
  USING (is_org_staff(auth.uid()) AND outline_id IN (
    SELECT po.id FROM proposal_outlines po
    JOIN solicitations s ON s.id = po.solicitation_id
    JOIN clients c ON c.id = s.client_id
    WHERE c.organization_id = current_user_org()
  ))
  WITH CHECK (is_org_staff(auth.uid()) AND outline_id IN (
    SELECT po.id FROM proposal_outlines po
    JOIN solicitations s ON s.id = po.solicitation_id
    JOIN clients c ON c.id = s.client_id
    WHERE c.organization_id = current_user_org()
  ));
CREATE POLICY "view outline nodes" ON public.outline_nodes
  FOR SELECT TO authenticated
  USING (outline_id IN (
    SELECT po.id FROM proposal_outlines po
    JOIN solicitations s ON s.id = po.solicitation_id
    JOIN clients c ON c.id = s.client_id
    WHERE c.organization_id = current_user_org()
  ));
CREATE TRIGGER outline_nodes_updated BEFORE UPDATE ON public.outline_nodes
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- ============ WIN_THEMES ============
CREATE TABLE public.win_themes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  solicitation_id UUID NOT NULL,
  title TEXT NOT NULL,
  theme_statement TEXT,
  discriminators TEXT[] NOT NULL DEFAULT '{}'::text[],
  ghosting_points TEXT[] NOT NULL DEFAULT '{}'::text[],
  proof_points TEXT[] NOT NULL DEFAULT '{}'::text[],
  linked_outline_node_ids UUID[] NOT NULL DEFAULT '{}'::uuid[],
  linked_requirement_ids UUID[] NOT NULL DEFAULT '{}'::uuid[],
  status public.win_theme_status NOT NULL DEFAULT 'draft',
  source_citations JSONB NOT NULL DEFAULT '[]'::jsonb,
  is_ai_generated BOOLEAN NOT NULL DEFAULT true,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_win_themes_sol ON public.win_themes(solicitation_id);
ALTER TABLE public.win_themes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "staff manage win themes" ON public.win_themes
  FOR ALL TO authenticated
  USING (is_org_staff(auth.uid()) AND solicitation_id IN (
    SELECT s.id FROM solicitations s JOIN clients c ON c.id = s.client_id
    WHERE c.organization_id = current_user_org()
  ))
  WITH CHECK (is_org_staff(auth.uid()) AND solicitation_id IN (
    SELECT s.id FROM solicitations s JOIN clients c ON c.id = s.client_id
    WHERE c.organization_id = current_user_org()
  ));
CREATE POLICY "view win themes" ON public.win_themes
  FOR SELECT TO authenticated
  USING (solicitation_id IN (
    SELECT s.id FROM solicitations s JOIN clients c ON c.id = s.client_id
    WHERE c.organization_id = current_user_org()
  ));
CREATE TRIGGER win_themes_updated BEFORE UPDATE ON public.win_themes
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
