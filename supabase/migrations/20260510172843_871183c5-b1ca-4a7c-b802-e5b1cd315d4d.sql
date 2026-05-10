
-- =========================================================
-- CLIENT PORTAL SCHEMA
-- =========================================================

-- client_users: portal accounts linked to a client
CREATE TABLE IF NOT EXISTS public.client_users (
  id UUID PRIMARY KEY,
  client_id UUID NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  email TEXT NOT NULL UNIQUE,
  full_name TEXT,
  avatar_url TEXT,
  is_primary BOOLEAN DEFAULT FALSE,
  notification_preferences JSONB NOT NULL DEFAULT '{"new_report":true,"analysis_updated":true,"question_answered":true}'::jsonb,
  last_login_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_client_users_client ON public.client_users(client_id);
CREATE INDEX IF NOT EXISTS idx_client_users_email ON public.client_users(email);

ALTER TABLE public.client_users ENABLE ROW LEVEL SECURITY;

-- Helper: check if current user is a client user, optionally for a given client
CREATE OR REPLACE FUNCTION public.is_client_user(_user_id UUID)
RETURNS BOOLEAN
LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS(SELECT 1 FROM public.client_users WHERE id = _user_id AND deleted_at IS NULL);
$$;

CREATE OR REPLACE FUNCTION public.current_client_id()
RETURNS UUID
LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT client_id FROM public.client_users WHERE id = auth.uid() AND deleted_at IS NULL LIMIT 1;
$$;

-- RLS: client_users
CREATE POLICY "client user view self" ON public.client_users
  FOR SELECT TO authenticated
  USING (id = auth.uid());

CREATE POLICY "client user view same client" ON public.client_users
  FOR SELECT TO authenticated
  USING (client_id = public.current_client_id());

CREATE POLICY "client user update self" ON public.client_users
  FOR UPDATE TO authenticated
  USING (id = auth.uid())
  WITH CHECK (id = auth.uid());

CREATE POLICY "staff view client users" ON public.client_users
  FOR SELECT TO authenticated
  USING (
    public.is_org_staff(auth.uid())
    AND client_id IN (SELECT id FROM public.clients WHERE organization_id = public.current_user_org())
  );

CREATE POLICY "staff manage client users" ON public.client_users
  FOR ALL TO authenticated
  USING (
    public.is_org_staff(auth.uid())
    AND client_id IN (SELECT id FROM public.clients WHERE organization_id = public.current_user_org())
  )
  WITH CHECK (
    public.is_org_staff(auth.uid())
    AND client_id IN (SELECT id FROM public.clients WHERE organization_id = public.current_user_org())
  );

CREATE TRIGGER trg_client_users_updated_at
BEFORE UPDATE ON public.client_users
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- =========================================================
-- client_user_invitations
-- =========================================================
CREATE TABLE IF NOT EXISTS public.client_user_invitations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  full_name TEXT,
  invited_by UUID,
  token TEXT NOT NULL UNIQUE DEFAULT encode(gen_random_bytes(24), 'hex'),
  status TEXT NOT NULL DEFAULT 'pending', -- pending | accepted | revoked
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '14 days'),
  accepted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_client_invitations_client ON public.client_user_invitations(client_id);
CREATE INDEX IF NOT EXISTS idx_client_invitations_email ON public.client_user_invitations(email);

ALTER TABLE public.client_user_invitations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "staff manage client invitations" ON public.client_user_invitations
  FOR ALL TO authenticated
  USING (
    public.is_org_staff(auth.uid())
    AND client_id IN (SELECT id FROM public.clients WHERE organization_id = public.current_user_org())
  )
  WITH CHECK (
    public.is_org_staff(auth.uid())
    AND client_id IN (SELECT id FROM public.clients WHERE organization_id = public.current_user_org())
  );

CREATE TRIGGER trg_client_invitations_updated_at
BEFORE UPDATE ON public.client_user_invitations
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- =========================================================
-- client_notifications
-- =========================================================
CREATE TABLE IF NOT EXISTS public.client_notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_user_id UUID NOT NULL REFERENCES public.client_users(id) ON DELETE CASCADE,
  solicitation_id UUID REFERENCES public.solicitations(id) ON DELETE CASCADE,
  notification_type TEXT NOT NULL,
  title TEXT NOT NULL,
  message TEXT,
  link_url TEXT,
  is_read BOOLEAN NOT NULL DEFAULT FALSE,
  read_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_client_notifications_user ON public.client_notifications(client_user_id);
CREATE INDEX IF NOT EXISTS idx_client_notifications_unread ON public.client_notifications(client_user_id, is_read);

ALTER TABLE public.client_notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "client user view own notifications" ON public.client_notifications
  FOR SELECT TO authenticated
  USING (client_user_id = auth.uid());

CREATE POLICY "client user update own notifications" ON public.client_notifications
  FOR UPDATE TO authenticated
  USING (client_user_id = auth.uid())
  WITH CHECK (client_user_id = auth.uid());

CREATE POLICY "staff manage client notifications" ON public.client_notifications
  FOR ALL TO authenticated
  USING (
    public.is_org_staff(auth.uid())
    AND client_user_id IN (
      SELECT cu.id FROM public.client_users cu
      JOIN public.clients c ON c.id = cu.client_id
      WHERE c.organization_id = public.current_user_org()
    )
  )
  WITH CHECK (
    public.is_org_staff(auth.uid())
    AND client_user_id IN (
      SELECT cu.id FROM public.client_users cu
      JOIN public.clients c ON c.id = cu.client_id
      WHERE c.organization_id = public.current_user_org()
    )
  );

ALTER PUBLICATION supabase_realtime ADD TABLE public.client_notifications;

-- =========================================================
-- client_support_messages
-- =========================================================
CREATE TABLE IF NOT EXISTS public.client_support_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_user_id UUID NOT NULL REFERENCES public.client_users(id) ON DELETE CASCADE,
  client_id UUID NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  solicitation_id UUID REFERENCES public.solicitations(id) ON DELETE SET NULL,
  subject TEXT NOT NULL,
  message TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'open', -- open | resolved
  resolved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_client_support_client ON public.client_support_messages(client_id);

ALTER TABLE public.client_support_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "client user create support" ON public.client_support_messages
  FOR INSERT TO authenticated
  WITH CHECK (client_user_id = auth.uid());

CREATE POLICY "client user view own support" ON public.client_support_messages
  FOR SELECT TO authenticated
  USING (client_user_id = auth.uid());

CREATE POLICY "staff manage support" ON public.client_support_messages
  FOR ALL TO authenticated
  USING (
    public.is_org_staff(auth.uid())
    AND client_id IN (SELECT id FROM public.clients WHERE organization_id = public.current_user_org())
  )
  WITH CHECK (
    public.is_org_staff(auth.uid())
    AND client_id IN (SELECT id FROM public.clients WHERE organization_id = public.current_user_org())
  );

CREATE TRIGGER trg_client_support_updated_at
BEFORE UPDATE ON public.client_support_messages
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- =========================================================
-- Extend RLS on existing tables for client portal access
-- =========================================================

-- Solicitations: client users can view their own client's solicitations
CREATE POLICY "client user view own solicitations" ON public.solicitations
  FOR SELECT TO authenticated
  USING (client_id = public.current_client_id());

-- Executive reports: client users can view client-accessible published reports
CREATE POLICY "client user view published reports" ON public.executive_reports
  FOR SELECT TO authenticated
  USING (
    client_accessible = TRUE
    AND is_published = TRUE
    AND solicitation_id IN (
      SELECT id FROM public.solicitations WHERE client_id = public.current_client_id()
    )
  );

-- Clients: a client user can read their own client record (for branding)
CREATE POLICY "client user view own client" ON public.clients
  FOR SELECT TO authenticated
  USING (id = public.current_client_id());

-- Documents: only when client has 'full' access
CREATE POLICY "client user view documents" ON public.documents
  FOR SELECT TO authenticated
  USING (
    solicitation_id IN (
      SELECT s.id FROM public.solicitations s
      JOIN public.clients c ON c.id = s.client_id
      WHERE c.id = public.current_client_id() AND c.access_level = 'full'
    )
  );

-- Annotations: client users can read non-private annotations on their solicitations (full access only)
CREATE POLICY "client user view annotations" ON public.annotations
  FOR SELECT TO authenticated
  USING (
    solicitation_id IN (
      SELECT s.id FROM public.solicitations s
      JOIN public.clients c ON c.id = s.client_id
      WHERE c.id = public.current_client_id() AND c.access_level = 'full'
    )
  );

-- Strategic questions: client users can view (full access only)
CREATE POLICY "client user view questions" ON public.strategic_questions
  FOR SELECT TO authenticated
  USING (
    solicitation_id IN (
      SELECT s.id FROM public.solicitations s
      JOIN public.clients c ON c.id = s.client_id
      WHERE c.id = public.current_client_id() AND c.access_level = 'full'
    )
  );
