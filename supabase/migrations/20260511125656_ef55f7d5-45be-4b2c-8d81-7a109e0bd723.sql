ALTER TABLE public.prior_import_history
  ADD COLUMN IF NOT EXISTS lookup_params jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS error_response jsonb;