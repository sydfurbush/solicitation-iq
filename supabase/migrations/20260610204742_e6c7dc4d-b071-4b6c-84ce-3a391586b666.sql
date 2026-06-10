
-- ============================================================
-- Solicitation AI Assistant: tables, RLS, presets, storage
-- ============================================================

-- assistant_threads -----------------------------------------------------------
CREATE TABLE public.assistant_threads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  solicitation_id UUID NOT NULL REFERENCES public.solicitations(id) ON DELETE CASCADE,
  created_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
  title TEXT NOT NULL DEFAULT 'New chat',
  pinned BOOLEAN NOT NULL DEFAULT FALSE,
  last_message_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_assistant_threads_sol ON public.assistant_threads(solicitation_id, last_message_at DESC);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.assistant_threads TO authenticated;
GRANT ALL ON public.assistant_threads TO service_role;
ALTER TABLE public.assistant_threads ENABLE ROW LEVEL SECURITY;

CREATE POLICY "org staff view threads" ON public.assistant_threads
  FOR SELECT TO authenticated
  USING (
    public.is_org_staff(auth.uid())
    AND solicitation_id IN (
      SELECT s.id FROM public.solicitations s
      JOIN public.clients c ON c.id = s.client_id
      WHERE c.organization_id = public.current_user_org()
    )
  );

CREATE POLICY "org staff manage threads" ON public.assistant_threads
  FOR ALL TO authenticated
  USING (
    public.is_org_staff(auth.uid())
    AND solicitation_id IN (
      SELECT s.id FROM public.solicitations s
      JOIN public.clients c ON c.id = s.client_id
      WHERE c.organization_id = public.current_user_org()
    )
  )
  WITH CHECK (
    public.is_org_staff(auth.uid())
    AND solicitation_id IN (
      SELECT s.id FROM public.solicitations s
      JOIN public.clients c ON c.id = s.client_id
      WHERE c.organization_id = public.current_user_org()
    )
  );

CREATE TRIGGER trg_assistant_threads_updated
  BEFORE UPDATE ON public.assistant_threads
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- assistant_messages ----------------------------------------------------------
CREATE TABLE public.assistant_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  thread_id UUID NOT NULL REFERENCES public.assistant_threads(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('user', 'assistant', 'system')),
  parts JSONB NOT NULL DEFAULT '[]'::jsonb,
  citations JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_assistant_messages_thread ON public.assistant_messages(thread_id, created_at);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.assistant_messages TO authenticated;
GRANT ALL ON public.assistant_messages TO service_role;
ALTER TABLE public.assistant_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "org staff view messages" ON public.assistant_messages
  FOR SELECT TO authenticated
  USING (
    thread_id IN (SELECT id FROM public.assistant_threads)
  );

CREATE POLICY "org staff manage messages" ON public.assistant_messages
  FOR ALL TO authenticated
  USING (
    thread_id IN (SELECT id FROM public.assistant_threads)
  )
  WITH CHECK (
    thread_id IN (SELECT id FROM public.assistant_threads)
  );

-- assistant_presets -----------------------------------------------------------
CREATE TABLE public.assistant_presets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  scope TEXT NOT NULL CHECK (scope IN ('system', 'user', 'org')),
  owner_id UUID REFERENCES public.users(id) ON DELETE CASCADE,
  organization_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE,
  label TEXT NOT NULL,
  prompt TEXT NOT NULL,
  icon TEXT,
  sort_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_assistant_presets_scope ON public.assistant_presets(scope, organization_id, owner_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.assistant_presets TO authenticated;
GRANT ALL ON public.assistant_presets TO service_role;
ALTER TABLE public.assistant_presets ENABLE ROW LEVEL SECURITY;

-- Anyone authenticated sees system presets + their own user presets + their org presets
CREATE POLICY "view applicable presets" ON public.assistant_presets
  FOR SELECT TO authenticated
  USING (
    scope = 'system'
    OR (scope = 'user' AND owner_id = auth.uid())
    OR (scope = 'org' AND organization_id = public.current_user_org())
  );

-- Users manage their own user presets
CREATE POLICY "users manage own presets" ON public.assistant_presets
  FOR ALL TO authenticated
  USING (scope = 'user' AND owner_id = auth.uid())
  WITH CHECK (scope = 'user' AND owner_id = auth.uid());

-- Org admins/owners manage org presets
CREATE POLICY "admins manage org presets" ON public.assistant_presets
  FOR ALL TO authenticated
  USING (
    scope = 'org'
    AND organization_id = public.current_user_org()
    AND (public.has_role(auth.uid(),'owner') OR public.has_role(auth.uid(),'admin'))
  )
  WITH CHECK (
    scope = 'org'
    AND organization_id = public.current_user_org()
    AND (public.has_role(auth.uid(),'owner') OR public.has_role(auth.uid(),'admin'))
  );

CREATE TRIGGER trg_assistant_presets_updated
  BEFORE UPDATE ON public.assistant_presets
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- Seed system presets
INSERT INTO public.assistant_presets (scope, label, prompt, icon, sort_order) VALUES
 ('system', 'Summarize risks',       'Summarize the top 5 risks in this solicitation, grouped by severity, with the current mitigation plan for each. Cite sources.', 'shield-alert', 10),
 ('system', 'Top opportunities',     'List the top opportunities by impact, with the recommended action plan and how they match the client''s capabilities. Cite sources.', 'sparkles', 20),
 ('system', 'Compliance gaps',       'What requirements in this solicitation does the client not yet have a clear capability for? Reference capability gaps.', 'file-warning', 30),
 ('system', 'Draft clarification',   'Draft a clarification question for the contracting officer about the most ambiguous requirement you can find. Include the exact section citation.', 'mail-question', 40),
 ('system', 'Compare to incumbent',  'Compare our position to the incumbent based on the documents and any incumbent notes. Where can we differentiate?', 'swords', 50),
 ('system', 'Win themes snapshot',   'Suggest 3-5 win themes for this solicitation given the evaluation criteria and our strengths.', 'trophy', 60),
 ('system', 'Requirement lookup',    'Find every requirement related to: [topic]. List section, page, and verbatim quote.', 'search', 70);

-- assistant_attachments -------------------------------------------------------
CREATE TABLE public.assistant_attachments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id UUID REFERENCES public.assistant_messages(id) ON DELETE CASCADE,
  thread_id UUID NOT NULL REFERENCES public.assistant_threads(id) ON DELETE CASCADE,
  storage_path TEXT NOT NULL,
  file_name TEXT NOT NULL,
  mime_type TEXT,
  size_bytes BIGINT,
  created_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_assistant_attachments_thread ON public.assistant_attachments(thread_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.assistant_attachments TO authenticated;
GRANT ALL ON public.assistant_attachments TO service_role;
ALTER TABLE public.assistant_attachments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "org staff view attachments" ON public.assistant_attachments
  FOR SELECT TO authenticated
  USING (thread_id IN (SELECT id FROM public.assistant_threads));

CREATE POLICY "org staff manage attachments" ON public.assistant_attachments
  FOR ALL TO authenticated
  USING (thread_id IN (SELECT id FROM public.assistant_threads))
  WITH CHECK (thread_id IN (SELECT id FROM public.assistant_threads));
