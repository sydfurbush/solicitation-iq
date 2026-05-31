
CREATE OR REPLACE FUNCTION public.set_member_role(p_user_id uuid, p_role public.app_role)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_org uuid;
  v_target_org uuid;
  v_old_role public.app_role;
  v_owner_count int;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'not authenticated';
  END IF;
  IF auth.uid() = p_user_id THEN
    RAISE EXCEPTION 'You cannot change your own role';
  END IF;
  IF NOT public.is_org_admin(auth.uid()) THEN
    RAISE EXCEPTION 'Only owners and admins can change member roles';
  END IF;

  v_org := public.current_user_org();
  SELECT organization_id INTO v_target_org FROM public.users WHERE id = p_user_id;
  IF v_target_org IS NULL OR v_target_org <> v_org THEN
    RAISE EXCEPTION 'User is not in your organization';
  END IF;

  SELECT role INTO v_old_role FROM public.user_roles
   WHERE user_id = p_user_id AND role IN ('owner','admin','analyst','viewer')
   LIMIT 1;

  IF (p_role = 'owner' OR v_old_role = 'owner')
     AND NOT public.has_role(auth.uid(), 'owner') THEN
    RAISE EXCEPTION 'Only owners can grant or revoke the owner role';
  END IF;

  IF v_old_role = 'owner' AND p_role <> 'owner' THEN
    SELECT count(*) INTO v_owner_count
      FROM public.user_roles ur
      JOIN public.users u ON u.id = ur.user_id
     WHERE u.organization_id = v_org AND ur.role = 'owner';
    IF v_owner_count <= 1 THEN
      RAISE EXCEPTION 'Cannot demote the last owner of the organization';
    END IF;
  END IF;

  DELETE FROM public.user_roles
   WHERE user_id = p_user_id AND role IN ('owner','admin','analyst','viewer');
  INSERT INTO public.user_roles (user_id, role) VALUES (p_user_id, p_role)
  ON CONFLICT DO NOTHING;
END;
$$;

CREATE OR REPLACE FUNCTION public.remove_org_member(p_user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_org uuid;
  v_target_org uuid;
  v_target_role public.app_role;
  v_owner_count int;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'not authenticated';
  END IF;
  IF auth.uid() = p_user_id THEN
    RAISE EXCEPTION 'You cannot remove yourself from the organization';
  END IF;
  IF NOT public.is_org_admin(auth.uid()) THEN
    RAISE EXCEPTION 'Only owners and admins can remove members';
  END IF;

  v_org := public.current_user_org();
  SELECT organization_id INTO v_target_org FROM public.users WHERE id = p_user_id;
  IF v_target_org IS NULL OR v_target_org <> v_org THEN
    RAISE EXCEPTION 'User is not in your organization';
  END IF;

  SELECT role INTO v_target_role FROM public.user_roles
   WHERE user_id = p_user_id AND role IN ('owner','admin','analyst','viewer')
   LIMIT 1;

  IF v_target_role = 'owner' THEN
    IF NOT public.has_role(auth.uid(), 'owner') THEN
      RAISE EXCEPTION 'Only owners can remove another owner';
    END IF;
    SELECT count(*) INTO v_owner_count
      FROM public.user_roles ur
      JOIN public.users u ON u.id = ur.user_id
     WHERE u.organization_id = v_org AND ur.role = 'owner';
    IF v_owner_count <= 1 THEN
      RAISE EXCEPTION 'Cannot remove the last owner of the organization';
    END IF;
  END IF;

  DELETE FROM public.user_roles
   WHERE user_id = p_user_id AND role IN ('owner','admin','analyst','viewer');
  UPDATE public.users SET organization_id = NULL WHERE id = p_user_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.set_member_role(uuid, public.app_role) TO authenticated;
GRANT EXECUTE ON FUNCTION public.remove_org_member(uuid) TO authenticated;
