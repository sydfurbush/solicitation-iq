
-- Enums
DO $$ BEGIN
  CREATE TYPE public.client_assignment_role AS ENUM ('lead','analyst');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.solicitation_assignment_role AS ENUM ('lead','analyst','contributor');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- client_assignments
CREATE TABLE IF NOT EXISTS public.client_assignments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  role public.client_assignment_role NOT NULL,
  assigned_by uuid,
  assigned_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (client_id, role)
);
CREATE INDEX IF NOT EXISTS idx_client_assignments_user ON public.client_assignments(user_id);
CREATE INDEX IF NOT EXISTS idx_client_assignments_client ON public.client_assignments(client_id);

-- solicitation_assignments
CREATE TABLE IF NOT EXISTS public.solicitation_assignments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  solicitation_id uuid NOT NULL REFERENCES public.solicitations(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  role public.solicitation_assignment_role NOT NULL,
  assigned_by uuid,
  assigned_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (solicitation_id, user_id, role)
);
-- enforce single Lead and single Analyst per solicitation
CREATE UNIQUE INDEX IF NOT EXISTS uniq_sol_lead
  ON public.solicitation_assignments(solicitation_id) WHERE role = 'lead';
CREATE UNIQUE INDEX IF NOT EXISTS uniq_sol_analyst
  ON public.solicitation_assignments(solicitation_id) WHERE role = 'analyst';
CREATE INDEX IF NOT EXISTS idx_sol_assignments_user ON public.solicitation_assignments(user_id);
CREATE INDEX IF NOT EXISTS idx_sol_assignments_sol ON public.solicitation_assignments(solicitation_id);

-- Helper functions
CREATE OR REPLACE FUNCTION public.is_org_admin(_user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role IN ('owner','admin')
  );
$$;

CREATE OR REPLACE FUNCTION public.is_solicitation_member(_user_id uuid, _sol_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT
    public.is_org_admin(_user_id)
    OR EXISTS (
      SELECT 1 FROM public.solicitation_assignments
      WHERE solicitation_id = _sol_id AND user_id = _user_id
    );
$$;

CREATE OR REPLACE FUNCTION public.is_solicitation_admin(_user_id uuid, _sol_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT
    public.is_org_admin(_user_id)
    OR EXISTS (
      SELECT 1 FROM public.solicitation_assignments
      WHERE solicitation_id = _sol_id AND user_id = _user_id AND role IN ('lead','analyst')
    );
$$;

CREATE OR REPLACE FUNCTION public.is_client_member(_user_id uuid, _client_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT
    public.is_org_admin(_user_id)
    OR EXISTS (SELECT 1 FROM public.client_assignments WHERE client_id = _client_id AND user_id = _user_id)
    OR EXISTS (
      SELECT 1 FROM public.solicitation_assignments sa
      JOIN public.solicitations s ON s.id = sa.solicitation_id
      WHERE s.client_id = _client_id AND sa.user_id = _user_id
    );
$$;

-- Trigger to copy client defaults onto new solicitations
CREATE OR REPLACE FUNCTION public.copy_client_defaults_to_solicitation()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.solicitation_assignments (solicitation_id, user_id, role, assigned_by)
  SELECT NEW.id, ca.user_id, ca.role::text::public.solicitation_assignment_role, auth.uid()
  FROM public.client_assignments ca
  WHERE ca.client_id = NEW.client_id
  ON CONFLICT DO NOTHING;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_copy_client_defaults ON public.solicitations;
CREATE TRIGGER trg_copy_client_defaults
AFTER INSERT ON public.solicitations
FOR EACH ROW EXECUTE FUNCTION public.copy_client_defaults_to_solicitation();

-- Backfill: org owner as Lead+Analyst on every client and solicitation
WITH org_owner AS (
  SELECT u.organization_id, u.id AS user_id
  FROM public.users u
  JOIN public.user_roles ur ON ur.user_id = u.id AND ur.role = 'owner'
  WHERE u.organization_id IS NOT NULL
)
INSERT INTO public.client_assignments (client_id, user_id, role)
SELECT c.id, oo.user_id, r.role::public.client_assignment_role
FROM public.clients c
JOIN org_owner oo ON oo.organization_id = c.organization_id
CROSS JOIN (VALUES ('lead'),('analyst')) r(role)
ON CONFLICT (client_id, role) DO NOTHING;

WITH org_owner AS (
  SELECT u.organization_id, u.id AS user_id
  FROM public.users u
  JOIN public.user_roles ur ON ur.user_id = u.id AND ur.role = 'owner'
  WHERE u.organization_id IS NOT NULL
)
INSERT INTO public.solicitation_assignments (solicitation_id, user_id, role)
SELECT s.id, oo.user_id, r.role::public.solicitation_assignment_role
FROM public.solicitations s
JOIN public.clients c ON c.id = s.client_id
JOIN org_owner oo ON oo.organization_id = c.organization_id
CROSS JOIN (VALUES ('lead'),('analyst')) r(role)
ON CONFLICT DO NOTHING;

-- RLS
ALTER TABLE public.client_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.solicitation_assignments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "ca_select_org" ON public.client_assignments FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.clients c
    WHERE c.id = client_assignments.client_id
      AND c.organization_id = public.current_user_org()
  )
);
CREATE POLICY "ca_write_admin" ON public.client_assignments FOR ALL
USING (
  public.is_org_admin(auth.uid())
  AND EXISTS (
    SELECT 1 FROM public.clients c
    WHERE c.id = client_assignments.client_id
      AND c.organization_id = public.current_user_org()
  )
)
WITH CHECK (
  public.is_org_admin(auth.uid())
  AND EXISTS (
    SELECT 1 FROM public.clients c
    WHERE c.id = client_assignments.client_id
      AND c.organization_id = public.current_user_org()
  )
);

CREATE POLICY "sa_select_org" ON public.solicitation_assignments FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.solicitations s
    JOIN public.clients c ON c.id = s.client_id
    WHERE s.id = solicitation_assignments.solicitation_id
      AND c.organization_id = public.current_user_org()
  )
);
CREATE POLICY "sa_write_admin_or_lead" ON public.solicitation_assignments FOR ALL
USING (
  public.is_solicitation_admin(auth.uid(), solicitation_assignments.solicitation_id)
)
WITH CHECK (
  public.is_solicitation_admin(auth.uid(), solicitation_assignments.solicitation_id)
);
