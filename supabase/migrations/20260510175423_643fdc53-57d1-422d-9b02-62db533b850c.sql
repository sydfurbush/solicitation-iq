CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_org_name text;
  v_org_id uuid;
  v_slug text;
BEGIN
  v_org_name := NULLIF(trim(NEW.raw_user_meta_data->>'organization_name'), '');

  -- If signup metadata includes an organization name, create the org + role.
  IF v_org_name IS NOT NULL THEN
    v_slug := lower(regexp_replace(v_org_name, '[^a-zA-Z0-9]+', '-', 'g'))
              || '-' || substr(replace(NEW.id::text, '-', ''), 1, 8);

    INSERT INTO public.organizations (name, slug)
    VALUES (v_org_name, v_slug)
    RETURNING id INTO v_org_id;

    INSERT INTO public.users (id, email, full_name, avatar_url, organization_id)
    VALUES (
      NEW.id,
      NEW.email,
      NEW.raw_user_meta_data->>'full_name',
      NEW.raw_user_meta_data->>'avatar_url',
      v_org_id
    )
    ON CONFLICT (id) DO UPDATE
      SET organization_id = EXCLUDED.organization_id,
          full_name = COALESCE(public.users.full_name, EXCLUDED.full_name);

    INSERT INTO public.user_roles (user_id, role)
    VALUES (NEW.id, 'owner'::app_role)
    ON CONFLICT DO NOTHING;
  ELSE
    -- Default behaviour (e.g., client portal signups, invites): just create the user row.
    INSERT INTO public.users (id, email, full_name, avatar_url)
    VALUES (
      NEW.id,
      NEW.email,
      NEW.raw_user_meta_data->>'full_name',
      NEW.raw_user_meta_data->>'avatar_url'
    )
    ON CONFLICT (id) DO NOTHING;
  END IF;

  RETURN NEW;
END;
$function$;

-- Make sure the trigger is wired up to auth.users
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

-- Allow new owners to insert their own user_roles row at signup time
DROP POLICY IF EXISTS "users insert own owner role" ON public.user_roles;
CREATE POLICY "users insert own owner role"
  ON public.user_roles FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());