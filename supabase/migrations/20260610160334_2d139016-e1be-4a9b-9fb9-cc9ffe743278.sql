
CREATE OR REPLACE FUNCTION public.client_in_current_org(_client_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.clients c
    JOIN public.users u ON u.id = auth.uid()
    WHERE c.id = _client_id
      AND c.organization_id = u.organization_id
  );
$$;

GRANT EXECUTE ON FUNCTION public.client_in_current_org(uuid) TO authenticated;

DROP POLICY IF EXISTS "staff create solicitations" ON public.solicitations;
DROP POLICY IF EXISTS "staff manage solicitations" ON public.solicitations;

CREATE POLICY "staff insert solicitations"
ON public.solicitations FOR INSERT TO authenticated
WITH CHECK (
  public.is_org_staff(auth.uid())
  AND public.client_in_current_org(client_id)
);

CREATE POLICY "staff update solicitations"
ON public.solicitations FOR UPDATE TO authenticated
USING (
  public.is_solicitation_member(auth.uid(), id)
  AND public.client_in_current_org(client_id)
)
WITH CHECK (
  public.client_in_current_org(client_id)
  AND public.is_org_staff(auth.uid())
);

CREATE POLICY "staff delete solicitations"
ON public.solicitations FOR DELETE TO authenticated
USING (
  public.is_org_admin(auth.uid())
  AND public.client_in_current_org(client_id)
);

REVOKE INSERT, UPDATE, DELETE, SELECT ON public.solicitations FROM anon;
