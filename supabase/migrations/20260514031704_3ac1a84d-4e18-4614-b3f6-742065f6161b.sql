-- Invitations table
CREATE TABLE public.org_invitations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  email text NOT NULL,
  role public.app_role NOT NULL DEFAULT 'analyst',
  token uuid NOT NULL UNIQUE DEFAULT gen_random_uuid(),
  invited_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  accepted_at timestamptz,
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '14 days'),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_org_invitations_email ON public.org_invitations (lower(email));
CREATE INDEX idx_org_invitations_org ON public.org_invitations (organization_id);

ALTER TABLE public.org_invitations ENABLE ROW LEVEL SECURITY;

-- Owners/admins can manage invitations for their own org
CREATE POLICY "Org admins manage invitations"
ON public.org_invitations
FOR ALL
TO authenticated
USING (
  organization_id = public.current_user_org()
  AND (public.has_role(auth.uid(), 'owner') OR public.has_role(auth.uid(), 'admin'))
)
WITH CHECK (
  organization_id = public.current_user_org()
  AND (public.has_role(auth.uid(), 'owner') OR public.has_role(auth.uid(), 'admin'))
);

-- Invited user can read their own pending invitation
CREATE POLICY "Invitee can read own invitation"
ON public.org_invitations
FOR SELECT
TO authenticated
USING (lower(email) = lower(coalesce((auth.jwt() ->> 'email'), '')));

-- Accept invitation
CREATE OR REPLACE FUNCTION public.accept_org_invitation(p_token uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_invite public.org_invitations%ROWTYPE;
  v_email text;
BEGIN
  v_email := lower(coalesce((auth.jwt() ->> 'email'), ''));
  IF v_email = '' THEN
    RAISE EXCEPTION 'not authenticated';
  END IF;

  SELECT * INTO v_invite FROM public.org_invitations
  WHERE token = p_token
    AND accepted_at IS NULL
    AND expires_at > now()
    AND lower(email) = v_email
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Invitation not found, expired, or for a different email';
  END IF;

  -- Ensure user row exists, then attach to org
  INSERT INTO public.users (id, email, organization_id)
  VALUES (auth.uid(), v_email, v_invite.organization_id)
  ON CONFLICT (id) DO UPDATE SET organization_id = v_invite.organization_id;

  INSERT INTO public.user_roles (user_id, role)
  VALUES (auth.uid(), v_invite.role)
  ON CONFLICT DO NOTHING;

  UPDATE public.org_invitations SET accepted_at = now() WHERE id = v_invite.id;

  RETURN v_invite.organization_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.accept_org_invitation(uuid) TO authenticated;

-- Owner/admin can pull an existing user into their org by email (for teammates who already signed up)
CREATE OR REPLACE FUNCTION public.attach_existing_user_to_org(p_email text, p_role public.app_role DEFAULT 'analyst')
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_org uuid;
  v_target uuid;
  v_old_org uuid;
BEGIN
  v_org := public.current_user_org();
  IF v_org IS NULL THEN
    RAISE EXCEPTION 'no organization';
  END IF;
  IF NOT (public.has_role(auth.uid(), 'owner') OR public.has_role(auth.uid(), 'admin')) THEN
    RAISE EXCEPTION 'not authorized';
  END IF;

  SELECT id, organization_id INTO v_target, v_old_org
  FROM public.users WHERE lower(email) = lower(p_email);

  IF v_target IS NULL THEN
    RAISE EXCEPTION 'user with email % not found', p_email;
  END IF;

  UPDATE public.users SET organization_id = v_org WHERE id = v_target;

  -- Replace old roles with the new role
  DELETE FROM public.user_roles WHERE user_id = v_target AND role IN ('owner','admin','analyst','viewer');
  INSERT INTO public.user_roles (user_id, role) VALUES (v_target, p_role)
  ON CONFLICT DO NOTHING;

  -- Optional cleanup: if old org has no remaining users, delete it
  IF v_old_org IS NOT NULL AND v_old_org <> v_org THEN
    IF NOT EXISTS (SELECT 1 FROM public.users WHERE organization_id = v_old_org) THEN
      DELETE FROM public.organizations WHERE id = v_old_org;
    END IF;
  END IF;

  RETURN v_target;
END;
$$;

GRANT EXECUTE ON FUNCTION public.attach_existing_user_to_org(text, public.app_role) TO authenticated;

-- Update handle_new_user to honor pending invitations
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_org_name text;
  v_org_id uuid;
  v_slug text;
  v_invite public.org_invitations%ROWTYPE;
BEGIN
  -- Look for a pending invitation matching this email
  SELECT * INTO v_invite FROM public.org_invitations
  WHERE lower(email) = lower(NEW.email)
    AND accepted_at IS NULL
    AND expires_at > now()
  ORDER BY created_at DESC
  LIMIT 1;

  IF FOUND THEN
    INSERT INTO public.users (id, email, full_name, avatar_url, organization_id)
    VALUES (NEW.id, NEW.email, NEW.raw_user_meta_data->>'full_name',
            NEW.raw_user_meta_data->>'avatar_url', v_invite.organization_id)
    ON CONFLICT (id) DO UPDATE SET organization_id = EXCLUDED.organization_id;

    INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, v_invite.role)
    ON CONFLICT DO NOTHING;

    UPDATE public.org_invitations SET accepted_at = now() WHERE id = v_invite.id;
    RETURN NEW;
  END IF;

  v_org_name := NULLIF(trim(NEW.raw_user_meta_data->>'organization_name'), '');

  IF v_org_name IS NOT NULL THEN
    v_slug := lower(regexp_replace(v_org_name, '[^a-zA-Z0-9]+', '-', 'g'))
              || '-' || substr(replace(NEW.id::text, '-', ''), 1, 8);

    INSERT INTO public.organizations (name, slug)
    VALUES (v_org_name, v_slug)
    RETURNING id INTO v_org_id;

    INSERT INTO public.users (id, email, full_name, avatar_url, organization_id)
    VALUES (NEW.id, NEW.email, NEW.raw_user_meta_data->>'full_name',
            NEW.raw_user_meta_data->>'avatar_url', v_org_id)
    ON CONFLICT (id) DO UPDATE
      SET organization_id = EXCLUDED.organization_id,
          full_name = COALESCE(public.users.full_name, EXCLUDED.full_name);

    INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'owner'::app_role)
    ON CONFLICT DO NOTHING;
  ELSE
    INSERT INTO public.users (id, email, full_name, avatar_url)
    VALUES (NEW.id, NEW.email, NEW.raw_user_meta_data->>'full_name',
            NEW.raw_user_meta_data->>'avatar_url')
    ON CONFLICT (id) DO NOTHING;
  END IF;

  RETURN NEW;
END;
$$;