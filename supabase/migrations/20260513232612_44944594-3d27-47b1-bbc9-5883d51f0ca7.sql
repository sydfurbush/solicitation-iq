
-- Client AI Lens: structured profile per client (1:1)
CREATE TABLE public.client_profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL UNIQUE REFERENCES public.clients(id) ON DELETE CASCADE,
  preset_key text,
  naics_codes text[] NOT NULL DEFAULT '{}',
  psc_codes text[] NOT NULL DEFAULT '{}',
  set_asides text[] NOT NULL DEFAULT '{}',
  agencies_focus text[] NOT NULL DEFAULT '{}',
  contract_vehicles text[] NOT NULL DEFAULT '{}',
  compliance_frameworks text[] NOT NULL DEFAULT '{}',
  discriminators jsonb NOT NULL DEFAULT '[]'::jsonb,
  acronym_glossary jsonb NOT NULL DEFAULT '{}'::jsonb,
  always_flag jsonb NOT NULL DEFAULT '[]'::jsonb,
  tone_voice text NOT NULL DEFAULT 'consultative',
  reading_level int NOT NULL DEFAULT 12,
  extra_notes text,
  version int NOT NULL DEFAULT 1,
  updated_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.client_profiles ENABLE ROW LEVEL SECURITY;

-- Per-solicitation override of the lens (sparse JSON)
ALTER TABLE public.solicitations
  ADD COLUMN IF NOT EXISTS lens_overrides jsonb NOT NULL DEFAULT '{}'::jsonb;

-- Bump version + timestamp on update
CREATE OR REPLACE FUNCTION public.bump_client_profile_version()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.version := COALESCE(OLD.version, 0) + 1;
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_client_profiles_bump_version
BEFORE UPDATE ON public.client_profiles
FOR EACH ROW
EXECUTE FUNCTION public.bump_client_profile_version();

CREATE TRIGGER trg_client_profiles_set_updated_at
BEFORE INSERT ON public.client_profiles
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at();

-- RLS: org staff manage; client portal users read their own
CREATE POLICY "staff manage client profiles"
ON public.client_profiles
FOR ALL TO authenticated
USING (
  is_org_staff(auth.uid())
  AND client_id IN (SELECT id FROM public.clients WHERE organization_id = current_user_org())
)
WITH CHECK (
  is_org_staff(auth.uid())
  AND client_id IN (SELECT id FROM public.clients WHERE organization_id = current_user_org())
);

CREATE POLICY "view org client profiles"
ON public.client_profiles
FOR SELECT TO authenticated
USING (
  client_id IN (SELECT id FROM public.clients WHERE organization_id = current_user_org())
);

CREATE POLICY "client user view own profile"
ON public.client_profiles
FOR SELECT TO authenticated
USING (client_id = current_client_id());

CREATE INDEX idx_client_profiles_client_id ON public.client_profiles(client_id);
