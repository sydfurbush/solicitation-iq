CREATE TABLE public.ai_model_settings (
  function_name text PRIMARY KEY,
  provider text NOT NULL CHECK (provider IN ('anthropic','lovable')),
  model text NOT NULL,
  max_tokens integer,
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid
);

ALTER TABLE public.ai_model_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "staff view ai model settings"
  ON public.ai_model_settings FOR SELECT
  TO authenticated
  USING (public.is_org_staff(auth.uid()));

CREATE POLICY "admins insert ai model settings"
  ON public.ai_model_settings FOR INSERT
  TO authenticated
  WITH CHECK (public.has_role(auth.uid(),'owner'::app_role) OR public.has_role(auth.uid(),'admin'::app_role));

CREATE POLICY "admins update ai model settings"
  ON public.ai_model_settings FOR UPDATE
  TO authenticated
  USING (public.has_role(auth.uid(),'owner'::app_role) OR public.has_role(auth.uid(),'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(),'owner'::app_role) OR public.has_role(auth.uid(),'admin'::app_role));

INSERT INTO public.ai_model_settings (function_name, provider, model, max_tokens) VALUES
  ('analyze-solicitation','anthropic','claude-sonnet-4-5',8192),
  ('identify-risks-opportunities','anthropic','claude-sonnet-4-5',8192),
  ('generate-questions','anthropic','claude-sonnet-4-5',8192),
  ('generate-report','anthropic','claude-sonnet-4-5',16384),
  ('compare-solicitations','anthropic','claude-sonnet-4-5',8192),
  ('extract-entities','anthropic','claude-haiku-4-5',4096);