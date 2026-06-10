CREATE OR REPLACE FUNCTION public.diagnose_solicitation_create(_client_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_auth_uid uuid;
  v_user_org uuid;
  v_user_email text;
  v_client_org uuid;
  v_client_name text;
  v_is_staff boolean;
  v_is_admin boolean;
  v_client_in_org boolean;
  v_has_insert_privilege boolean;
  v_has_select_privilege boolean;
BEGIN
  v_auth_uid := auth.uid();

  SELECT u.organization_id, u.email
    INTO v_user_org, v_user_email
  FROM public.users u
  WHERE u.id = v_auth_uid;

  SELECT c.organization_id, c.name
    INTO v_client_org, v_client_name
  FROM public.clients c
  WHERE c.id = _client_id;

  v_is_staff := public.is_org_staff(v_auth_uid);
  v_is_admin := public.is_org_admin(v_auth_uid);
  v_client_in_org := public.client_in_current_org(_client_id);
  v_has_insert_privilege := has_table_privilege('authenticated', 'public.solicitations', 'INSERT');
  v_has_select_privilege := has_table_privilege('authenticated', 'public.solicitations', 'SELECT');

  RETURN jsonb_build_object(
    'inputs', jsonb_build_object(
      'client_id', _client_id
    ),
    'session', jsonb_build_object(
      'auth_uid', v_auth_uid,
      'jwt_role', auth.role(),
      'email', v_user_email
    ),
    'user', jsonb_build_object(
      'organization_id', v_user_org,
      'is_org_staff', COALESCE(v_is_staff, false),
      'is_org_admin', COALESCE(v_is_admin, false)
    ),
    'client', jsonb_build_object(
      'exists', v_client_org IS NOT NULL,
      'organization_id', v_client_org,
      'name', v_client_name
    ),
    'solicitations_insert_policy_checks', jsonb_build_object(
      'authenticated_session_present', v_auth_uid IS NOT NULL,
      'table_insert_granted_to_authenticated', COALESCE(v_has_insert_privilege, false),
      'table_select_granted_to_authenticated', COALESCE(v_has_select_privilege, false),
      'staff_create_solicitations__is_org_staff', COALESCE(v_is_staff, false),
      'staff_create_solicitations__client_in_current_org', COALESCE(v_client_in_org, false),
      'staff_create_solicitations__overall_with_check', COALESCE(v_is_staff, false) AND COALESCE(v_client_in_org, false)
    ),
    'likely_failure', CASE
      WHEN v_auth_uid IS NULL THEN 'No authenticated user was present in the request.'
      WHEN NOT COALESCE(v_has_insert_privilege, false) THEN 'The authenticated role does not have table-level create permission for solicitations.'
      WHEN NOT COALESCE(v_is_staff, false) THEN 'The user is not owner, admin, or analyst, so the staff create policy fails.'
      WHEN v_client_org IS NULL THEN 'The selected client does not exist or is not visible to the diagnostic helper.'
      WHEN v_user_org IS NULL THEN 'The signed-in user does not have an organization_id, so client/org matching fails.'
      WHEN v_client_org IS DISTINCT FROM v_user_org THEN 'The selected client belongs to a different organization than the signed-in user.'
      WHEN NOT COALESCE(v_client_in_org, false) THEN 'client_in_current_org(client_id) returned false.'
      ELSE 'The solicitation insert policy checks passed; failure may be caused by a trigger, a related-table policy, or a read-back/select after insert.'
    END,
    'checked_at', now()
  );
END;
$$;

REVOKE ALL ON FUNCTION public.diagnose_solicitation_create(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.diagnose_solicitation_create(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.diagnose_solicitation_create(uuid) TO service_role;