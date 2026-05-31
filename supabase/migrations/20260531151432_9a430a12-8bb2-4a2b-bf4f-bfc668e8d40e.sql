
-- 1) Scope user_roles admin writes to same org as the target user
DROP POLICY IF EXISTS "admins manage roles" ON public.user_roles;
DROP POLICY IF EXISTS "admins view org roles" ON public.user_roles;

CREATE POLICY "admins manage roles"
ON public.user_roles
FOR ALL
TO authenticated
USING (
  (public.has_role(auth.uid(), 'owner'::public.app_role)
   OR public.has_role(auth.uid(), 'admin'::public.app_role))
  AND (SELECT u.organization_id FROM public.users u WHERE u.id = user_roles.user_id)
      = public.current_user_org()
)
WITH CHECK (
  (public.has_role(auth.uid(), 'owner'::public.app_role)
   OR public.has_role(auth.uid(), 'admin'::public.app_role))
  AND (SELECT u.organization_id FROM public.users u WHERE u.id = user_roles.user_id)
      = public.current_user_org()
);

CREATE POLICY "admins view org roles"
ON public.user_roles
FOR SELECT
TO authenticated
USING (
  (public.has_role(auth.uid(), 'owner'::public.app_role)
   OR public.has_role(auth.uid(), 'admin'::public.app_role))
  AND (SELECT u.organization_id FROM public.users u WHERE u.id = user_roles.user_id)
      = public.current_user_org()
);

-- 2) Restrict client portal risk reads to only items shared with the client
DROP POLICY IF EXISTS "client user view risks" ON public.risks;

CREATE POLICY "client user view risks"
ON public.risks
FOR SELECT
TO authenticated
USING (
  sent_to_client = true
  AND solicitation_id IN (
    SELECT s.id
    FROM public.solicitations s
    JOIN public.clients c ON c.id = s.client_id
    WHERE c.id = public.current_client_id()
  )
);
