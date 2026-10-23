CREATE TABLE public.client_onboarding_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  file_name text NOT NULL,
  file_path text NOT NULL,
  mime_type text,
  byte_size integer,
  uploaded_by uuid,
  uploaded_by_kind text NOT NULL CHECK (uploaded_by_kind IN ('staff','client')),
  status text NOT NULL DEFAULT 'uploaded' CHECK (status IN ('uploaded','processing','triaged','failed')),
  error text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
CREATE INDEX idx_client_onboarding_documents_client ON public.client_onboarding_documents(client_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.client_onboarding_documents TO authenticated;
GRANT ALL ON public.client_onboarding_documents TO service_role;
ALTER TABLE public.client_onboarding_documents ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.client_owned_by_my_org(_client_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT public.is_org_staff(auth.uid()) AND EXISTS (
    SELECT 1 FROM public.clients c WHERE c.id = _client_id AND c.organization_id = public.current_user_org()
  )
$$;
CREATE OR REPLACE FUNCTION public.can_edit_onboarding(_client_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT public.client_owned_by_my_org(_client_id) AND (
    public.has_role(auth.uid(),'owner') OR public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'analyst')
  )
$$;

CREATE POLICY "Staff read onboarding docs" ON public.client_onboarding_documents FOR SELECT TO authenticated
  USING (public.client_owned_by_my_org(client_id));
CREATE POLICY "Editors insert onboarding docs" ON public.client_onboarding_documents FOR INSERT TO authenticated
  WITH CHECK (public.can_edit_onboarding(client_id) AND uploaded_by = auth.uid() AND uploaded_by_kind = 'staff');
CREATE POLICY "Editors delete onboarding docs" ON public.client_onboarding_documents FOR DELETE TO authenticated
  USING (public.can_edit_onboarding(client_id));
CREATE POLICY "Clients read own onboarding docs" ON public.client_onboarding_documents FOR SELECT TO authenticated
  USING (public.is_client_user(auth.uid()) AND client_id = public.current_client_id());
CREATE POLICY "Clients insert own onboarding docs" ON public.client_onboarding_documents FOR INSERT TO authenticated
  WITH CHECK (public.is_client_user(auth.uid()) AND client_id = public.current_client_id() AND uploaded_by = auth.uid() AND uploaded_by_kind = 'client' AND status = 'uploaded');
CREATE POLICY "Clients delete own untriaged uploads" ON public.client_onboarding_documents FOR DELETE TO authenticated
  USING (public.is_client_user(auth.uid()) AND client_id = public.current_client_id() AND uploaded_by = auth.uid() AND status <> 'triaged');

CREATE TABLE public.client_onboarding_triage (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id uuid NOT NULL UNIQUE REFERENCES public.client_onboarding_documents(id) ON DELETE CASCADE,
  client_id uuid NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  doc_type text, relevance text, title text, summary text, document_date text,
  solicitation_numbers text[] DEFAULT '{}', useful_for text[] DEFAULT '{}',
  sensitivity jsonb DEFAULT '{}', destinations text[] DEFAULT '{}',
  requires_cleaning boolean DEFAULT false, reasons text[] DEFAULT '{}',
  notes text, text_chars integer, final_destinations text[], review_note text,
  reviewed_by uuid, reviewed_at timestamptz,
  created_at timestamptz DEFAULT now(), updated_at timestamptz DEFAULT now()
);
CREATE INDEX idx_client_onboarding_triage_client ON public.client_onboarding_triage(client_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.client_onboarding_triage TO authenticated;
GRANT ALL ON public.client_onboarding_triage TO service_role;
REVOKE UPDATE ON public.client_onboarding_triage FROM authenticated;
GRANT UPDATE (final_destinations, review_note, reviewed_by, reviewed_at) ON public.client_onboarding_triage TO authenticated;
ALTER TABLE public.client_onboarding_triage ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Staff read triage" ON public.client_onboarding_triage FOR SELECT TO authenticated
  USING (public.client_owned_by_my_org(client_id));
CREATE POLICY "Editors review triage" ON public.client_onboarding_triage FOR UPDATE TO authenticated
  USING (public.can_edit_onboarding(client_id)) WITH CHECK (public.can_edit_onboarding(client_id));

CREATE POLICY "Clients upload own onboarding files" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'client-onboarding' AND public.is_client_user(auth.uid()) AND (storage.foldername(name))[1] = public.current_client_id()::text);
CREATE POLICY "Clients read own onboarding files" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'client-onboarding' AND public.is_client_user(auth.uid()) AND (storage.foldername(name))[1] = public.current_client_id()::text);
CREATE POLICY "Staff read onboarding files" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'client-onboarding' AND EXISTS (SELECT 1 FROM public.clients c WHERE c.id::text = (storage.foldername(name))[1] AND public.client_owned_by_my_org(c.id)));
CREATE POLICY "Staff upload onboarding files" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'client-onboarding' AND EXISTS (SELECT 1 FROM public.clients c WHERE c.id::text = (storage.foldername(name))[1] AND public.client_owned_by_my_org(c.id)));
CREATE POLICY "Staff delete onboarding files" ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'client-onboarding' AND EXISTS (SELECT 1 FROM public.clients c WHERE c.id::text = (storage.foldername(name))[1] AND public.client_owned_by_my_org(c.id)));