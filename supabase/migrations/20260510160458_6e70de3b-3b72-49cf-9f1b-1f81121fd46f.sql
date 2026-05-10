
-- Extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- =====================================================
-- ENUMS
-- =====================================================
CREATE TYPE app_role AS ENUM ('owner', 'admin', 'analyst', 'viewer');
CREATE TYPE client_access_level AS ENUM ('full', 'summary', 'restricted');
CREATE TYPE document_type AS ENUM ('rfp','rfq','rfi','pre_solicitation','sow','terms_conditions','amendment','qa_log','evaluation_criteria','pricing_sheet','incumbent_contract','prior_solicitation','attachment','other');
CREATE TYPE document_status AS ENUM ('uploading','processing','parsed','analyzed','failed');
CREATE TYPE solicitation_status AS ENUM ('intake','processing','phase_1_complete','phase_2_active','phase_3_active','phase_4_active','complete','archived');
CREATE TYPE question_category AS ENUM ('clarification','strategic','scope_expansion','risk_concern','compliance');
CREATE TYPE question_recommendation AS ENUM ('ask','hold','monitor','internal_only');
CREATE TYPE risk_severity AS ENUM ('critical','high','medium','low','informational');
CREATE TYPE opportunity_type AS ENUM ('innovation','cost_reduction','scope_expansion','efficiency','differentiation','incumbent_weakness','evaluation_advantage');
CREATE TYPE phase_type AS ENUM ('phase_1_initial','phase_2_deep_dive','phase_3_outline','phase_4_win_themes');
CREATE TYPE annotation_type AS ENUM ('note','flag','question','highlight','action_item','win_theme','discriminator');

-- =====================================================
-- CORE TABLES
-- =====================================================
CREATE TABLE public.organizations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL,
    slug TEXT UNIQUE NOT NULL,
    logo_url TEXT,
    settings JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    deleted_at TIMESTAMPTZ
);

CREATE TABLE public.users (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    organization_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE,
    email TEXT NOT NULL,
    full_name TEXT,
    avatar_url TEXT,
    settings JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    deleted_at TIMESTAMPTZ
);

-- SECURITY: roles live in a separate table to prevent privilege escalation
CREATE TABLE public.user_roles (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    role app_role NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id, role)
);

CREATE TABLE public.clients (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    industry TEXT,
    website TEXT,
    logo_url TEXT,
    primary_contact_name TEXT,
    primary_contact_email TEXT,
    access_level client_access_level DEFAULT 'summary',
    notes TEXT,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    deleted_at TIMESTAMPTZ
);

CREATE TABLE public.solicitations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    client_id UUID NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    solicitation_number TEXT,
    issuing_agency TEXT,
    agency_type TEXT,
    release_date DATE,
    questions_due_date TIMESTAMPTZ,
    proposal_due_date TIMESTAMPTZ,
    expected_award_date DATE,
    period_of_performance_start DATE,
    period_of_performance_end DATE,
    estimated_value_low NUMERIC(15,2),
    estimated_value_high NUMERIC(15,2),
    contract_type TEXT,
    has_incumbent BOOLEAN DEFAULT FALSE,
    incumbent_name TEXT,
    incumbent_contract_number TEXT,
    incumbent_contract_value NUMERIC(15,2),
    incumbent_performance_notes TEXT,
    status solicitation_status DEFAULT 'intake',
    current_phase phase_type DEFAULT 'phase_1_initial',
    ai_summary TEXT,
    ai_confidence_score NUMERIC(3,2),
    key_requirements JSONB DEFAULT '[]',
    evaluation_factors JSONB DEFAULT '[]',
    tags TEXT[] DEFAULT '{}',
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    deleted_at TIMESTAMPTZ
);

CREATE TABLE public.documents (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    solicitation_id UUID NOT NULL REFERENCES public.solicitations(id) ON DELETE CASCADE,
    file_name TEXT NOT NULL,
    file_path TEXT NOT NULL,
    file_size INTEGER,
    file_type TEXT,
    document_type document_type DEFAULT 'other',
    version INTEGER DEFAULT 1,
    replaces_document_id UUID REFERENCES public.documents(id) ON DELETE SET NULL,
    is_current BOOLEAN DEFAULT TRUE,
    status document_status DEFAULT 'uploading',
    processing_started_at TIMESTAMPTZ,
    processing_completed_at TIMESTAMPTZ,
    processing_error TEXT,
    total_pages INTEGER,
    extracted_text TEXT,
    table_of_contents JSONB,
    ai_summary TEXT,
    ai_document_classification JSONB,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    deleted_at TIMESTAMPTZ
);

CREATE TABLE public.document_sections (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    document_id UUID NOT NULL REFERENCES public.documents(id) ON DELETE CASCADE,
    section_number TEXT,
    section_title TEXT,
    page_start INTEGER,
    page_end INTEGER,
    content TEXT NOT NULL,
    content_type TEXT,
    parent_section_id UUID REFERENCES public.document_sections(id) ON DELETE SET NULL,
    depth INTEGER DEFAULT 0,
    sort_order INTEGER DEFAULT 0,
    ai_importance_score NUMERIC(3,2),
    ai_tags TEXT[] DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE public.extracted_entities (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    document_id UUID NOT NULL REFERENCES public.documents(id) ON DELETE CASCADE,
    section_id UUID REFERENCES public.document_sections(id) ON DELETE SET NULL,
    entity_type TEXT NOT NULL,
    entity_value TEXT NOT NULL,
    normalized_value TEXT,
    page_number INTEGER,
    section_reference TEXT,
    context_snippet TEXT,
    confidence_score NUMERIC(3,2),
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE public.strategic_questions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    solicitation_id UUID NOT NULL REFERENCES public.solicitations(id) ON DELETE CASCADE,
    question_text TEXT NOT NULL,
    question_rationale TEXT,
    category question_category NOT NULL,
    recommendation question_recommendation DEFAULT 'monitor',
    priority INTEGER DEFAULT 50,
    source_document_id UUID REFERENCES public.documents(id) ON DELETE SET NULL,
    source_section_id UUID REFERENCES public.document_sections(id) ON DELETE SET NULL,
    source_citation TEXT,
    source_quote TEXT,
    strategic_advantage_notes TEXT,
    potential_answer_insight TEXT,
    is_submitted BOOLEAN DEFAULT FALSE,
    submitted_at TIMESTAMPTZ,
    agency_response TEXT,
    is_ai_generated BOOLEAN DEFAULT TRUE,
    created_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE public.risks (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    solicitation_id UUID NOT NULL REFERENCES public.solicitations(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    description TEXT NOT NULL,
    severity risk_severity DEFAULT 'medium',
    source_document_id UUID REFERENCES public.documents(id) ON DELETE SET NULL,
    source_citation TEXT,
    source_quote TEXT,
    mitigation_strategy TEXT,
    is_mitigated BOOLEAN DEFAULT FALSE,
    is_ai_generated BOOLEAN DEFAULT TRUE,
    created_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE public.opportunities (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    solicitation_id UUID NOT NULL REFERENCES public.solicitations(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    description TEXT NOT NULL,
    opportunity_type opportunity_type NOT NULL,
    impact_score INTEGER DEFAULT 50,
    source_document_id UUID REFERENCES public.documents(id) ON DELETE SET NULL,
    source_citation TEXT,
    source_quote TEXT,
    recommended_approach TEXT,
    client_capability_match TEXT,
    is_ai_generated BOOLEAN DEFAULT TRUE,
    created_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE public.solicitation_phases (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    solicitation_id UUID NOT NULL REFERENCES public.solicitations(id) ON DELETE CASCADE,
    phase phase_type NOT NULL,
    status TEXT DEFAULT 'not_started',
    started_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    completed_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
    deliverables JSONB DEFAULT '[]',
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(solicitation_id, phase)
);

CREATE TABLE public.annotations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    solicitation_id UUID NOT NULL REFERENCES public.solicitations(id) ON DELETE CASCADE,
    document_id UUID REFERENCES public.documents(id) ON DELETE CASCADE,
    section_id UUID REFERENCES public.document_sections(id) ON DELETE SET NULL,
    user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    annotation_type annotation_type NOT NULL,
    content TEXT NOT NULL,
    page_number INTEGER,
    position_data JSONB,
    is_resolved BOOLEAN DEFAULT FALSE,
    resolved_at TIMESTAMPTZ,
    resolved_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE public.executive_reports (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    solicitation_id UUID NOT NULL REFERENCES public.solicitations(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    report_type TEXT DEFAULT 'full',
    version INTEGER DEFAULT 1,
    content JSONB NOT NULL,
    generated_at TIMESTAMPTZ DEFAULT NOW(),
    generated_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
    is_published BOOLEAN DEFAULT FALSE,
    published_at TIMESTAMPTZ,
    client_accessible BOOLEAN DEFAULT FALSE,
    file_path TEXT,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE public.solicitation_access (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    solicitation_id UUID NOT NULL REFERENCES public.solicitations(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    access_level TEXT DEFAULT 'view',
    granted_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
    granted_at TIMESTAMPTZ DEFAULT NOW(),
    expires_at TIMESTAMPTZ,
    UNIQUE(solicitation_id, user_id)
);

CREATE TABLE public.prior_solicitations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    solicitation_id UUID NOT NULL REFERENCES public.solicitations(id) ON DELETE CASCADE,
    prior_solicitation_id UUID REFERENCES public.solicitations(id) ON DELETE SET NULL,
    external_reference TEXT,
    external_url TEXT,
    comparison_summary TEXT,
    changes_identified JSONB DEFAULT '[]',
    comparison_completed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- =====================================================
-- INDEXES
-- =====================================================
CREATE INDEX idx_users_organization ON public.users(organization_id);
CREATE INDEX idx_user_roles_user ON public.user_roles(user_id);
CREATE INDEX idx_clients_organization ON public.clients(organization_id);
CREATE INDEX idx_solicitations_client ON public.solicitations(client_id);
CREATE INDEX idx_solicitations_status ON public.solicitations(status);
CREATE INDEX idx_documents_solicitation ON public.documents(solicitation_id);
CREATE INDEX idx_documents_status ON public.documents(status);
CREATE INDEX idx_document_sections_document ON public.document_sections(document_id);
CREATE INDEX idx_extracted_entities_document ON public.extracted_entities(document_id);
CREATE INDEX idx_strategic_questions_solicitation ON public.strategic_questions(solicitation_id);
CREATE INDEX idx_risks_solicitation ON public.risks(solicitation_id);
CREATE INDEX idx_opportunities_solicitation ON public.opportunities(solicitation_id);
CREATE INDEX idx_annotations_solicitation ON public.annotations(solicitation_id);
CREATE INDEX idx_annotations_user ON public.annotations(user_id);
CREATE INDEX idx_executive_reports_solicitation ON public.executive_reports(solicitation_id);
CREATE INDEX idx_solicitation_access_user ON public.solicitation_access(user_id);
CREATE INDEX idx_documents_text_search ON public.documents USING gin(to_tsvector('english', COALESCE(extracted_text, '')));
CREATE INDEX idx_document_sections_content_search ON public.document_sections USING gin(to_tsvector('english', content));

-- =====================================================
-- SECURITY DEFINER HELPERS
-- =====================================================
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  );
$$;

CREATE OR REPLACE FUNCTION public.current_user_org()
RETURNS UUID
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT organization_id FROM public.users WHERE id = auth.uid();
$$;

CREATE OR REPLACE FUNCTION public.is_org_staff(_user_id UUID)
RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role IN ('owner','admin','analyst')
  );
$$;

-- =====================================================
-- updated_at TRIGGER FUNCTION
-- =====================================================
CREATE OR REPLACE FUNCTION public.update_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_organizations_updated BEFORE UPDATE ON public.organizations FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
CREATE TRIGGER trg_users_updated BEFORE UPDATE ON public.users FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
CREATE TRIGGER trg_clients_updated BEFORE UPDATE ON public.clients FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
CREATE TRIGGER trg_solicitations_updated BEFORE UPDATE ON public.solicitations FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
CREATE TRIGGER trg_documents_updated BEFORE UPDATE ON public.documents FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
CREATE TRIGGER trg_document_sections_updated BEFORE UPDATE ON public.document_sections FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
CREATE TRIGGER trg_strategic_questions_updated BEFORE UPDATE ON public.strategic_questions FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
CREATE TRIGGER trg_risks_updated BEFORE UPDATE ON public.risks FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
CREATE TRIGGER trg_opportunities_updated BEFORE UPDATE ON public.opportunities FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
CREATE TRIGGER trg_solicitation_phases_updated BEFORE UPDATE ON public.solicitation_phases FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
CREATE TRIGGER trg_annotations_updated BEFORE UPDATE ON public.annotations FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
CREATE TRIGGER trg_executive_reports_updated BEFORE UPDATE ON public.executive_reports FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
CREATE TRIGGER trg_prior_solicitations_updated BEFORE UPDATE ON public.prior_solicitations FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- =====================================================
-- AUTO-CREATE PROFILE ON SIGNUP
-- =====================================================
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  INSERT INTO public.users (id, email, full_name, avatar_url)
  VALUES (
    NEW.id,
    NEW.email,
    NEW.raw_user_meta_data->>'full_name',
    NEW.raw_user_meta_data->>'avatar_url'
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- =====================================================
-- ROW LEVEL SECURITY
-- =====================================================
ALTER TABLE public.organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.clients ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.solicitations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.document_sections ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.extracted_entities ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.strategic_questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.risks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.opportunities ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.solicitation_phases ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.annotations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.executive_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.solicitation_access ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.prior_solicitations ENABLE ROW LEVEL SECURITY;

-- organizations
CREATE POLICY "view own organization" ON public.organizations
  FOR SELECT TO authenticated USING (id = public.current_user_org());

-- users (profile)
CREATE POLICY "view own profile" ON public.users
  FOR SELECT TO authenticated USING (id = auth.uid());
CREATE POLICY "view org members" ON public.users
  FOR SELECT TO authenticated USING (organization_id = public.current_user_org());
CREATE POLICY "update own profile" ON public.users
  FOR UPDATE TO authenticated USING (id = auth.uid()) WITH CHECK (id = auth.uid());

-- user_roles: read-only to authenticated; only service_role can mutate
CREATE POLICY "view own roles" ON public.user_roles
  FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "admins view org roles" ON public.user_roles
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'owner') OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "admins manage roles" ON public.user_roles
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'owner') OR public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'owner') OR public.has_role(auth.uid(), 'admin'));

-- clients
CREATE POLICY "view org clients" ON public.clients
  FOR SELECT TO authenticated USING (organization_id = public.current_user_org());
CREATE POLICY "admins manage clients" ON public.clients
  FOR ALL TO authenticated
  USING (organization_id = public.current_user_org() AND (public.has_role(auth.uid(),'owner') OR public.has_role(auth.uid(),'admin')))
  WITH CHECK (organization_id = public.current_user_org() AND (public.has_role(auth.uid(),'owner') OR public.has_role(auth.uid(),'admin')));

-- solicitations
CREATE POLICY "view accessible solicitations" ON public.solicitations
  FOR SELECT TO authenticated USING (
    client_id IN (SELECT id FROM public.clients WHERE organization_id = public.current_user_org())
  );
CREATE POLICY "staff manage solicitations" ON public.solicitations
  FOR ALL TO authenticated
  USING (
    public.is_org_staff(auth.uid())
    AND client_id IN (SELECT id FROM public.clients WHERE organization_id = public.current_user_org())
  )
  WITH CHECK (
    public.is_org_staff(auth.uid())
    AND client_id IN (SELECT id FROM public.clients WHERE organization_id = public.current_user_org())
  );

-- documents
CREATE POLICY "view solicitation documents" ON public.documents
  FOR SELECT TO authenticated USING (
    solicitation_id IN (
      SELECT s.id FROM public.solicitations s
      JOIN public.clients c ON c.id = s.client_id
      WHERE c.organization_id = public.current_user_org()
    )
  );
CREATE POLICY "staff manage documents" ON public.documents
  FOR ALL TO authenticated
  USING (
    public.is_org_staff(auth.uid()) AND solicitation_id IN (
      SELECT s.id FROM public.solicitations s
      JOIN public.clients c ON c.id = s.client_id
      WHERE c.organization_id = public.current_user_org()
    )
  )
  WITH CHECK (
    public.is_org_staff(auth.uid()) AND solicitation_id IN (
      SELECT s.id FROM public.solicitations s
      JOIN public.clients c ON c.id = s.client_id
      WHERE c.organization_id = public.current_user_org()
    )
  );

-- document_sections
CREATE POLICY "view document sections" ON public.document_sections
  FOR SELECT TO authenticated USING (
    document_id IN (
      SELECT d.id FROM public.documents d
      JOIN public.solicitations s ON s.id = d.solicitation_id
      JOIN public.clients c ON c.id = s.client_id
      WHERE c.organization_id = public.current_user_org()
    )
  );
CREATE POLICY "staff manage document sections" ON public.document_sections
  FOR ALL TO authenticated
  USING (
    public.is_org_staff(auth.uid()) AND document_id IN (
      SELECT d.id FROM public.documents d
      JOIN public.solicitations s ON s.id = d.solicitation_id
      JOIN public.clients c ON c.id = s.client_id
      WHERE c.organization_id = public.current_user_org()
    )
  )
  WITH CHECK (
    public.is_org_staff(auth.uid()) AND document_id IN (
      SELECT d.id FROM public.documents d
      JOIN public.solicitations s ON s.id = d.solicitation_id
      JOIN public.clients c ON c.id = s.client_id
      WHERE c.organization_id = public.current_user_org()
    )
  );

-- extracted_entities
CREATE POLICY "view extracted entities" ON public.extracted_entities
  FOR SELECT TO authenticated USING (
    document_id IN (
      SELECT d.id FROM public.documents d
      JOIN public.solicitations s ON s.id = d.solicitation_id
      JOIN public.clients c ON c.id = s.client_id
      WHERE c.organization_id = public.current_user_org()
    )
  );
CREATE POLICY "staff manage extracted entities" ON public.extracted_entities
  FOR ALL TO authenticated
  USING (
    public.is_org_staff(auth.uid()) AND document_id IN (
      SELECT d.id FROM public.documents d
      JOIN public.solicitations s ON s.id = d.solicitation_id
      JOIN public.clients c ON c.id = s.client_id
      WHERE c.organization_id = public.current_user_org()
    )
  )
  WITH CHECK (
    public.is_org_staff(auth.uid()) AND document_id IN (
      SELECT d.id FROM public.documents d
      JOIN public.solicitations s ON s.id = d.solicitation_id
      JOIN public.clients c ON c.id = s.client_id
      WHERE c.organization_id = public.current_user_org()
    )
  );

-- strategic_questions, risks, opportunities, phases, executive_reports, prior_solicitations: same pattern via solicitation
CREATE POLICY "view strategic questions" ON public.strategic_questions
  FOR SELECT TO authenticated USING (
    solicitation_id IN (SELECT s.id FROM public.solicitations s JOIN public.clients c ON c.id=s.client_id WHERE c.organization_id = public.current_user_org())
  );
CREATE POLICY "staff manage strategic questions" ON public.strategic_questions
  FOR ALL TO authenticated
  USING (public.is_org_staff(auth.uid()) AND solicitation_id IN (SELECT s.id FROM public.solicitations s JOIN public.clients c ON c.id=s.client_id WHERE c.organization_id = public.current_user_org()))
  WITH CHECK (public.is_org_staff(auth.uid()) AND solicitation_id IN (SELECT s.id FROM public.solicitations s JOIN public.clients c ON c.id=s.client_id WHERE c.organization_id = public.current_user_org()));

CREATE POLICY "view risks" ON public.risks
  FOR SELECT TO authenticated USING (
    solicitation_id IN (SELECT s.id FROM public.solicitations s JOIN public.clients c ON c.id=s.client_id WHERE c.organization_id = public.current_user_org())
  );
CREATE POLICY "staff manage risks" ON public.risks
  FOR ALL TO authenticated
  USING (public.is_org_staff(auth.uid()) AND solicitation_id IN (SELECT s.id FROM public.solicitations s JOIN public.clients c ON c.id=s.client_id WHERE c.organization_id = public.current_user_org()))
  WITH CHECK (public.is_org_staff(auth.uid()) AND solicitation_id IN (SELECT s.id FROM public.solicitations s JOIN public.clients c ON c.id=s.client_id WHERE c.organization_id = public.current_user_org()));

CREATE POLICY "view opportunities" ON public.opportunities
  FOR SELECT TO authenticated USING (
    solicitation_id IN (SELECT s.id FROM public.solicitations s JOIN public.clients c ON c.id=s.client_id WHERE c.organization_id = public.current_user_org())
  );
CREATE POLICY "staff manage opportunities" ON public.opportunities
  FOR ALL TO authenticated
  USING (public.is_org_staff(auth.uid()) AND solicitation_id IN (SELECT s.id FROM public.solicitations s JOIN public.clients c ON c.id=s.client_id WHERE c.organization_id = public.current_user_org()))
  WITH CHECK (public.is_org_staff(auth.uid()) AND solicitation_id IN (SELECT s.id FROM public.solicitations s JOIN public.clients c ON c.id=s.client_id WHERE c.organization_id = public.current_user_org()));

CREATE POLICY "view phases" ON public.solicitation_phases
  FOR SELECT TO authenticated USING (
    solicitation_id IN (SELECT s.id FROM public.solicitations s JOIN public.clients c ON c.id=s.client_id WHERE c.organization_id = public.current_user_org())
  );
CREATE POLICY "staff manage phases" ON public.solicitation_phases
  FOR ALL TO authenticated
  USING (public.is_org_staff(auth.uid()) AND solicitation_id IN (SELECT s.id FROM public.solicitations s JOIN public.clients c ON c.id=s.client_id WHERE c.organization_id = public.current_user_org()))
  WITH CHECK (public.is_org_staff(auth.uid()) AND solicitation_id IN (SELECT s.id FROM public.solicitations s JOIN public.clients c ON c.id=s.client_id WHERE c.organization_id = public.current_user_org()));

CREATE POLICY "view annotations" ON public.annotations
  FOR SELECT TO authenticated USING (
    solicitation_id IN (SELECT s.id FROM public.solicitations s JOIN public.clients c ON c.id=s.client_id WHERE c.organization_id = public.current_user_org())
  );
CREATE POLICY "manage own annotations" ON public.annotations
  FOR ALL TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

CREATE POLICY "view executive reports" ON public.executive_reports
  FOR SELECT TO authenticated USING (
    solicitation_id IN (SELECT s.id FROM public.solicitations s JOIN public.clients c ON c.id=s.client_id WHERE c.organization_id = public.current_user_org())
  );
CREATE POLICY "staff manage executive reports" ON public.executive_reports
  FOR ALL TO authenticated
  USING (public.is_org_staff(auth.uid()) AND solicitation_id IN (SELECT s.id FROM public.solicitations s JOIN public.clients c ON c.id=s.client_id WHERE c.organization_id = public.current_user_org()))
  WITH CHECK (public.is_org_staff(auth.uid()) AND solicitation_id IN (SELECT s.id FROM public.solicitations s JOIN public.clients c ON c.id=s.client_id WHERE c.organization_id = public.current_user_org()));

CREATE POLICY "view solicitation access" ON public.solicitation_access
  FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "admins manage solicitation access" ON public.solicitation_access
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'owner') OR public.has_role(auth.uid(),'admin'))
  WITH CHECK (public.has_role(auth.uid(),'owner') OR public.has_role(auth.uid(),'admin'));

CREATE POLICY "view prior solicitations" ON public.prior_solicitations
  FOR SELECT TO authenticated USING (
    solicitation_id IN (SELECT s.id FROM public.solicitations s JOIN public.clients c ON c.id=s.client_id WHERE c.organization_id = public.current_user_org())
  );
CREATE POLICY "staff manage prior solicitations" ON public.prior_solicitations
  FOR ALL TO authenticated
  USING (public.is_org_staff(auth.uid()) AND solicitation_id IN (SELECT s.id FROM public.solicitations s JOIN public.clients c ON c.id=s.client_id WHERE c.organization_id = public.current_user_org()))
  WITH CHECK (public.is_org_staff(auth.uid()) AND solicitation_id IN (SELECT s.id FROM public.solicitations s JOIN public.clients c ON c.id=s.client_id WHERE c.organization_id = public.current_user_org()));
