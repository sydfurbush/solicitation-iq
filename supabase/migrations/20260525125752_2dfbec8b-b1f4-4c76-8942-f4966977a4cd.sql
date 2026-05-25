
-- 1) brand-assets: require admin/owner for writes
DROP POLICY IF EXISTS "brand-assets org write" ON storage.objects;
DROP POLICY IF EXISTS "brand-assets org update" ON storage.objects;
DROP POLICY IF EXISTS "brand-assets org delete" ON storage.objects;

CREATE POLICY "brand-assets org write"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'brand-assets'
  AND (storage.foldername(name))[1] = (public.current_user_org())::text
  AND (public.has_role(auth.uid(), 'owner'::public.app_role) OR public.has_role(auth.uid(), 'admin'::public.app_role))
);

CREATE POLICY "brand-assets org update"
ON storage.objects FOR UPDATE TO authenticated
USING (
  bucket_id = 'brand-assets'
  AND (storage.foldername(name))[1] = (public.current_user_org())::text
  AND (public.has_role(auth.uid(), 'owner'::public.app_role) OR public.has_role(auth.uid(), 'admin'::public.app_role))
)
WITH CHECK (
  bucket_id = 'brand-assets'
  AND (storage.foldername(name))[1] = (public.current_user_org())::text
  AND (public.has_role(auth.uid(), 'owner'::public.app_role) OR public.has_role(auth.uid(), 'admin'::public.app_role))
);

CREATE POLICY "brand-assets org delete"
ON storage.objects FOR DELETE TO authenticated
USING (
  bucket_id = 'brand-assets'
  AND (storage.foldername(name))[1] = (public.current_user_org())::text
  AND (public.has_role(auth.uid(), 'owner'::public.app_role) OR public.has_role(auth.uid(), 'admin'::public.app_role))
);

-- 2) proposal-exhibits: add org scoping (path is {org_id}/{solicitation_id}/{exhibit_id}/{filename})
DROP POLICY IF EXISTS "staff read exhibits files" ON storage.objects;
DROP POLICY IF EXISTS "staff insert exhibits files" ON storage.objects;
DROP POLICY IF EXISTS "staff update exhibits files" ON storage.objects;
DROP POLICY IF EXISTS "staff delete exhibits files" ON storage.objects;

CREATE POLICY "staff read exhibits files"
ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'proposal-exhibits'
  AND public.is_org_staff(auth.uid())
  AND (storage.foldername(name))[1] = (public.current_user_org())::text
);

CREATE POLICY "staff insert exhibits files"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'proposal-exhibits'
  AND public.is_org_staff(auth.uid())
  AND (storage.foldername(name))[1] = (public.current_user_org())::text
);

CREATE POLICY "staff update exhibits files"
ON storage.objects FOR UPDATE TO authenticated
USING (
  bucket_id = 'proposal-exhibits'
  AND public.is_org_staff(auth.uid())
  AND (storage.foldername(name))[1] = (public.current_user_org())::text
)
WITH CHECK (
  bucket_id = 'proposal-exhibits'
  AND public.is_org_staff(auth.uid())
  AND (storage.foldername(name))[1] = (public.current_user_org())::text
);

CREATE POLICY "staff delete exhibits files"
ON storage.objects FOR DELETE TO authenticated
USING (
  bucket_id = 'proposal-exhibits'
  AND public.is_org_staff(auth.uid())
  AND (storage.foldername(name))[1] = (public.current_user_org())::text
);

-- 3) reports bucket: fix broken read policy + add org scoping to writes
-- path = {solicitation_id}/{report_id}/{filename}
DROP POLICY IF EXISTS "view org reports" ON storage.objects;
DROP POLICY IF EXISTS "staff upload reports" ON storage.objects;
DROP POLICY IF EXISTS "staff update reports" ON storage.objects;
DROP POLICY IF EXISTS "staff delete reports" ON storage.objects;

CREATE POLICY "view org reports"
ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'reports'
  AND public.is_org_staff(auth.uid())
  AND EXISTS (
    SELECT 1 FROM public.solicitations s
    JOIN public.clients c ON c.id = s.client_id
    WHERE c.organization_id = public.current_user_org()
      AND s.id::text = (storage.foldername(name))[1]
  )
);

CREATE POLICY "staff upload reports"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'reports'
  AND public.is_org_staff(auth.uid())
  AND EXISTS (
    SELECT 1 FROM public.solicitations s
    JOIN public.clients c ON c.id = s.client_id
    WHERE c.organization_id = public.current_user_org()
      AND s.id::text = (storage.foldername(name))[1]
  )
);

CREATE POLICY "staff update reports"
ON storage.objects FOR UPDATE TO authenticated
USING (
  bucket_id = 'reports'
  AND public.is_org_staff(auth.uid())
  AND EXISTS (
    SELECT 1 FROM public.solicitations s
    JOIN public.clients c ON c.id = s.client_id
    WHERE c.organization_id = public.current_user_org()
      AND s.id::text = (storage.foldername(name))[1]
  )
)
WITH CHECK (
  bucket_id = 'reports'
  AND public.is_org_staff(auth.uid())
  AND EXISTS (
    SELECT 1 FROM public.solicitations s
    JOIN public.clients c ON c.id = s.client_id
    WHERE c.organization_id = public.current_user_org()
      AND s.id::text = (storage.foldername(name))[1]
  )
);

CREATE POLICY "staff delete reports"
ON storage.objects FOR DELETE TO authenticated
USING (
  bucket_id = 'reports'
  AND public.is_org_staff(auth.uid())
  AND EXISTS (
    SELECT 1 FROM public.solicitations s
    JOIN public.clients c ON c.id = s.client_id
    WHERE c.organization_id = public.current_user_org()
      AND s.id::text = (storage.foldername(name))[1]
  )
);

-- 4) user_roles: remove self-insert privilege escalation
DROP POLICY IF EXISTS "users insert own owner role" ON public.user_roles;
