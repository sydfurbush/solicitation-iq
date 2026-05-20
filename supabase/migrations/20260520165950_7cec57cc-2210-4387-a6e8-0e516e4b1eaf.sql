CREATE OR REPLACE FUNCTION public.is_solicitation_member(_user_id uuid, _sol_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT
    (
      public.is_org_admin(_user_id)
      AND EXISTS (
        SELECT 1
        FROM public.solicitations s
        JOIN public.clients c ON c.id = s.client_id
        JOIN public.users u ON u.id = _user_id
        WHERE s.id = _sol_id
          AND c.organization_id = u.organization_id
      )
    )
    OR EXISTS (
      SELECT 1 FROM public.solicitation_assignments
      WHERE solicitation_id = _sol_id AND user_id = _user_id
    );
$function$;