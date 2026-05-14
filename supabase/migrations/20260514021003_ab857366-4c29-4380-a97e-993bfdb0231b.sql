-- Service Presets: org-scoped customs + global built-ins, immutable versions

CREATE TABLE public.lens_presets (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id uuid REFERENCES public.organizations(id) ON DELETE CASCADE,
  key text NOT NULL,
  label text NOT NULL,
  description text,
  family text NOT NULL DEFAULT 'federal',
  is_builtin boolean NOT NULL DEFAULT false,
  current_version_id uuid,
  created_by uuid,
  deleted_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX lens_presets_org_key_unique
  ON public.lens_presets (COALESCE(organization_id, '00000000-0000-0000-0000-000000000000'::uuid), key)
  WHERE deleted_at IS NULL;

CREATE TABLE public.lens_preset_versions (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  preset_id uuid NOT NULL REFERENCES public.lens_presets(id) ON DELETE CASCADE,
  version integer NOT NULL,
  content jsonb NOT NULL DEFAULT '{}'::jsonb,
  change_note text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (preset_id, version)
);

ALTER TABLE public.lens_presets
  ADD CONSTRAINT lens_presets_current_version_fk
  FOREIGN KEY (current_version_id) REFERENCES public.lens_preset_versions(id) ON DELETE SET NULL;

CREATE INDEX lens_preset_versions_preset_idx ON public.lens_preset_versions (preset_id, version DESC);

ALTER TABLE public.lens_presets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lens_preset_versions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "view presets" ON public.lens_presets
  FOR SELECT TO authenticated
  USING (deleted_at IS NULL AND (organization_id IS NULL OR organization_id = current_user_org()));

CREATE POLICY "admins insert org presets" ON public.lens_presets
  FOR INSERT TO authenticated
  WITH CHECK (
    organization_id = current_user_org() AND is_builtin = false
    AND (has_role(auth.uid(), 'owner'::app_role) OR has_role(auth.uid(), 'admin'::app_role))
  );

CREATE POLICY "admins update org presets" ON public.lens_presets
  FOR UPDATE TO authenticated
  USING (
    organization_id = current_user_org() AND is_builtin = false
    AND (has_role(auth.uid(), 'owner'::app_role) OR has_role(auth.uid(), 'admin'::app_role))
  )
  WITH CHECK (
    organization_id = current_user_org() AND is_builtin = false
    AND (has_role(auth.uid(), 'owner'::app_role) OR has_role(auth.uid(), 'admin'::app_role))
  );

CREATE POLICY "admins delete org presets" ON public.lens_presets
  FOR DELETE TO authenticated
  USING (
    organization_id = current_user_org() AND is_builtin = false
    AND (has_role(auth.uid(), 'owner'::app_role) OR has_role(auth.uid(), 'admin'::app_role))
  );

CREATE POLICY "view preset versions" ON public.lens_preset_versions
  FOR SELECT TO authenticated
  USING (preset_id IN (
    SELECT id FROM public.lens_presets
    WHERE deleted_at IS NULL
      AND (organization_id IS NULL OR organization_id = current_user_org())
  ));

CREATE POLICY "admins insert preset versions" ON public.lens_preset_versions
  FOR INSERT TO authenticated
  WITH CHECK (
    preset_id IN (
      SELECT id FROM public.lens_presets
      WHERE organization_id = current_user_org() AND is_builtin = false
    )
    AND (has_role(auth.uid(), 'owner'::app_role) OR has_role(auth.uid(), 'admin'::app_role))
  );

CREATE TRIGGER trg_lens_presets_updated_at
  BEFORE UPDATE ON public.lens_presets
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- Seed an empty placeholder preset so JSON seeding can be done in next step via insert tool
INSERT INTO public.lens_presets (organization_id, key, label, description, family, is_builtin)
VALUES (NULL, '__seed_marker__', 'seed', 'placeholder', 'federal', true);