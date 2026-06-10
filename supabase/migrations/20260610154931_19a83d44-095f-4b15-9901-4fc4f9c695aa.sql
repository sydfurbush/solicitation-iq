-- Ensure org staff can create solicitations. The existing ALL policy's WITH CHECK
-- can fail intermittently if is_org_staff() execute privilege is not propagated
-- to the authenticated role for the current connection. Add an explicit INSERT
-- policy and (re)assert EXECUTE grants on the helper functions used in WITH CHECK.

GRANT EXECUTE ON FUNCTION public.is_org_staff(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_org_admin(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.current_user_org() TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_solicitation_member(uuid, uuid) TO authenticated;

-- Add a dedicated INSERT policy so creating a solicitation only requires that
-- the caller is org staff and the chosen client belongs to their org.
DROP POLICY IF EXISTS "staff create solicitations" ON public.solicitations;
CREATE POLICY "staff create solicitations"
ON public.solicitations
FOR INSERT
TO authenticated
WITH CHECK (
  public.is_org_staff(auth.uid())
  AND client_id IN (
    SELECT c.id FROM public.clients c
    WHERE c.organization_id = public.current_user_org()
  )
);