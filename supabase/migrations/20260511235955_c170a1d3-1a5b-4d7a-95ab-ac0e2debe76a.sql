
-- Allow org admins/owners to update their organization (for brand settings)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policy
    WHERE polrelid = 'public.organizations'::regclass
      AND polname = 'admins update own organization'
  ) THEN
    CREATE POLICY "admins update own organization"
      ON public.organizations
      FOR UPDATE
      TO authenticated
      USING (
        id = public.current_user_org()
        AND (
          public.has_role(auth.uid(), 'admin'::public.app_role)
          OR public.has_role(auth.uid(), 'owner'::public.app_role)
        )
      )
      WITH CHECK (
        id = public.current_user_org()
        AND (
          public.has_role(auth.uid(), 'admin'::public.app_role)
          OR public.has_role(auth.uid(), 'owner'::public.app_role)
        )
      );
  END IF;
END$$;

-- Public bucket for brand assets (logos)
INSERT INTO storage.buckets (id, name, public)
VALUES ('brand-assets', 'brand-assets', true)
ON CONFLICT (id) DO UPDATE SET public = true;

-- Anyone can view (bucket is public anyway), authenticated members can upload to their org folder
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policy WHERE polname = 'brand-assets public read') THEN
    CREATE POLICY "brand-assets public read"
      ON storage.objects FOR SELECT
      USING (bucket_id = 'brand-assets');
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policy WHERE polname = 'brand-assets org write') THEN
    CREATE POLICY "brand-assets org write"
      ON storage.objects FOR INSERT
      TO authenticated
      WITH CHECK (
        bucket_id = 'brand-assets'
        AND (storage.foldername(name))[1] = public.current_user_org()::text
      );
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policy WHERE polname = 'brand-assets org update') THEN
    CREATE POLICY "brand-assets org update"
      ON storage.objects FOR UPDATE
      TO authenticated
      USING (
        bucket_id = 'brand-assets'
        AND (storage.foldername(name))[1] = public.current_user_org()::text
      );
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policy WHERE polname = 'brand-assets org delete') THEN
    CREATE POLICY "brand-assets org delete"
      ON storage.objects FOR DELETE
      TO authenticated
      USING (
        bucket_id = 'brand-assets'
        AND (storage.foldername(name))[1] = public.current_user_org()::text
      );
  END IF;
END$$;
