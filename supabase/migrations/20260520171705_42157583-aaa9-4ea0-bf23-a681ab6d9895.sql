
-- One default per (organization, vertical)
CREATE UNIQUE INDEX IF NOT EXISTS bfp_one_default_per_vertical
ON public.buyer_format_profiles(organization_id, vertical)
WHERE is_default;

-- Auto-seed a federal default profile for every new organization
CREATE OR REPLACE FUNCTION public.seed_default_format_profile()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.buyer_format_profiles (organization_id, name, is_default, vertical, notes)
  VALUES (NEW.id, 'Federal default', true, 'federal',
          'Auto-seeded baseline. Edit in Settings → Format profiles.')
  ON CONFLICT DO NOTHING;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_seed_format_profile ON public.organizations;
CREATE TRIGGER trg_seed_format_profile
AFTER INSERT ON public.organizations
FOR EACH ROW EXECUTE FUNCTION public.seed_default_format_profile();
