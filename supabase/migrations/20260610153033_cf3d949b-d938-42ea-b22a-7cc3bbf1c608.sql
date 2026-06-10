
-- 1) AI model settings: scope by organization_id
ALTER TABLE public.ai_model_settings ADD COLUMN IF NOT EXISTS organization_id uuid REFERENCES public.organizations(id) ON DELETE CASCADE;

-- Clear existing global rows; they duplicated built-in defaults and were not org-scoped.
DELETE FROM public.ai_model_settings WHERE organization_id IS NULL;

ALTER TABLE public.ai_model_settings ALTER COLUMN organization_id SET NOT NULL;

-- Replace unique constraint on function_name with (organization_id, function_name)
DO $$
DECLARE r record;
BEGIN
  FOR r IN
    SELECT conname FROM pg_constraint
    WHERE conrelid = 'public.ai_model_settings'::regclass
      AND contype = 'u'
  LOOP
    EXECUTE format('ALTER TABLE public.ai_model_settings DROP CONSTRAINT %I', r.conname);
  END LOOP;
END $$;

ALTER TABLE public.ai_model_settings
  ADD CONSTRAINT ai_model_settings_org_function_unique UNIQUE (organization_id, function_name);

CREATE INDEX IF NOT EXISTS idx_ai_model_settings_org ON public.ai_model_settings(organization_id);

-- Replace policies with org-scoped versions
DROP POLICY IF EXISTS "Admins can read AI model settings" ON public.ai_model_settings;
DROP POLICY IF EXISTS "Admins can insert AI model settings" ON public.ai_model_settings;
DROP POLICY IF EXISTS "Admins can update AI model settings" ON public.ai_model_settings;
DROP POLICY IF EXISTS "ai_model_settings_select_admin" ON public.ai_model_settings;
DROP POLICY IF EXISTS "ai_model_settings_insert_admin" ON public.ai_model_settings;
DROP POLICY IF EXISTS "ai_model_settings_update_admin" ON public.ai_model_settings;
DROP POLICY IF EXISTS "ai_model_settings_delete_admin" ON public.ai_model_settings;

CREATE POLICY "ai_model_settings_select_admin"
  ON public.ai_model_settings FOR SELECT TO authenticated
  USING (public.is_org_admin(auth.uid()) AND organization_id = public.current_user_org());

CREATE POLICY "ai_model_settings_insert_admin"
  ON public.ai_model_settings FOR INSERT TO authenticated
  WITH CHECK (public.is_org_admin(auth.uid()) AND organization_id = public.current_user_org());

CREATE POLICY "ai_model_settings_update_admin"
  ON public.ai_model_settings FOR UPDATE TO authenticated
  USING (public.is_org_admin(auth.uid()) AND organization_id = public.current_user_org())
  WITH CHECK (public.is_org_admin(auth.uid()) AND organization_id = public.current_user_org());

CREATE POLICY "ai_model_settings_delete_admin"
  ON public.ai_model_settings FOR DELETE TO authenticated
  USING (public.is_org_admin(auth.uid()) AND organization_id = public.current_user_org());

-- 2) solicitation_access: scope admin writes to current org
DROP POLICY IF EXISTS "admins manage solicitation access" ON public.solicitation_access;
CREATE POLICY "admins manage solicitation access"
  ON public.solicitation_access FOR ALL TO authenticated
  USING (
    public.is_org_admin(auth.uid())
    AND solicitation_id IN (
      SELECT s.id FROM public.solicitations s
      JOIN public.clients c ON c.id = s.client_id
      WHERE c.organization_id = public.current_user_org()
    )
  )
  WITH CHECK (
    public.is_org_admin(auth.uid())
    AND solicitation_id IN (
      SELECT s.id FROM public.solicitations s
      JOIN public.clients c ON c.id = s.client_id
      WHERE c.organization_id = public.current_user_org()
    )
  );

-- 3) is_solicitation_admin: restrict to lead only (admins/owners still allowed via is_org_admin)
CREATE OR REPLACE FUNCTION public.is_solicitation_admin(_user_id uuid, _sol_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT
    public.is_org_admin(_user_id)
    OR EXISTS (
      SELECT 1 FROM public.solicitation_assignments
      WHERE solicitation_id = _sol_id AND user_id = _user_id AND role = 'lead'
    );
$function$;
