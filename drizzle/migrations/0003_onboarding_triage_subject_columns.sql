ALTER TABLE public.client_onboarding_triage
  ADD COLUMN subject text DEFAULT 'client',
  ADD COLUMN subject_name text,
  ADD COLUMN partner_names text[] DEFAULT '{}',
  ADD COLUMN client_role text DEFAULT 'unknown';

ALTER TABLE public.client_onboarding_triage
  ADD CONSTRAINT client_onboarding_triage_subject_check
  CHECK (subject IN ('client','partner','government','other'));

ALTER TABLE public.client_onboarding_triage
  ADD CONSTRAINT client_onboarding_triage_client_role_check
  CHECK (client_role IN ('prime','sub','both','unknown'));

ALTER TABLE public.client_onboarding_documents
  ADD COLUMN knowledge_document_id uuid REFERENCES public.client_knowledge_documents(id) ON DELETE SET NULL;

ALTER TABLE public.client_onboarding_documents
  ADD CONSTRAINT client_onboarding_documents_knowledge_document_id_key
  UNIQUE (knowledge_document_id);
