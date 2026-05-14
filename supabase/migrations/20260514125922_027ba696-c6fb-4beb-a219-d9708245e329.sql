
-- ============== CLIENTS ==============
DROP POLICY IF EXISTS "view org clients" ON public.clients;
CREATE POLICY "view org clients" ON public.clients
  FOR SELECT USING (
    organization_id = current_user_org()
    AND public.is_client_member(auth.uid(), id)
  );

-- ============== SOLICITATIONS ==============
DROP POLICY IF EXISTS "view accessible solicitations" ON public.solicitations;
CREATE POLICY "view accessible solicitations" ON public.solicitations
  FOR SELECT USING (
    public.is_solicitation_member(auth.uid(), id)
  );

DROP POLICY IF EXISTS "staff manage solicitations" ON public.solicitations;
CREATE POLICY "staff manage solicitations" ON public.solicitations
  FOR ALL USING (
    public.is_solicitation_member(auth.uid(), id)
    AND client_id IN (SELECT id FROM public.clients WHERE organization_id = current_user_org())
  ) WITH CHECK (
    client_id IN (SELECT id FROM public.clients WHERE organization_id = current_user_org())
    AND (public.is_org_admin(auth.uid()) OR is_org_staff(auth.uid()))
  );

-- ============== documents ==============
DROP POLICY IF EXISTS "view solicitation documents" ON public.documents;
CREATE POLICY "view solicitation documents" ON public.documents
  FOR SELECT USING (public.is_solicitation_member(auth.uid(), solicitation_id));
DROP POLICY IF EXISTS "staff manage documents" ON public.documents;
CREATE POLICY "staff manage documents" ON public.documents
  FOR ALL USING (public.is_solicitation_member(auth.uid(), solicitation_id))
  WITH CHECK (public.is_solicitation_member(auth.uid(), solicitation_id));

-- ============== document_sections (via document_id) ==============
DROP POLICY IF EXISTS "view document sections" ON public.document_sections;
CREATE POLICY "view document sections" ON public.document_sections
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.documents d
            WHERE d.id = document_sections.document_id
              AND public.is_solicitation_member(auth.uid(), d.solicitation_id))
  );
DROP POLICY IF EXISTS "staff manage document sections" ON public.document_sections;
CREATE POLICY "staff manage document sections" ON public.document_sections
  FOR ALL USING (
    EXISTS (SELECT 1 FROM public.documents d
            WHERE d.id = document_sections.document_id
              AND public.is_solicitation_member(auth.uid(), d.solicitation_id))
  ) WITH CHECK (
    EXISTS (SELECT 1 FROM public.documents d
            WHERE d.id = document_sections.document_id
              AND public.is_solicitation_member(auth.uid(), d.solicitation_id))
  );

-- ============== extracted_entities (via document_id) ==============
DROP POLICY IF EXISTS "view extracted entities" ON public.extracted_entities;
CREATE POLICY "view extracted entities" ON public.extracted_entities
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.documents d
            WHERE d.id = extracted_entities.document_id
              AND public.is_solicitation_member(auth.uid(), d.solicitation_id))
  );
DROP POLICY IF EXISTS "staff manage extracted entities" ON public.extracted_entities;
CREATE POLICY "staff manage extracted entities" ON public.extracted_entities
  FOR ALL USING (
    EXISTS (SELECT 1 FROM public.documents d
            WHERE d.id = extracted_entities.document_id
              AND public.is_solicitation_member(auth.uid(), d.solicitation_id))
  ) WITH CHECK (
    EXISTS (SELECT 1 FROM public.documents d
            WHERE d.id = extracted_entities.document_id
              AND public.is_solicitation_member(auth.uid(), d.solicitation_id))
  );

-- ============== outline_nodes (via outline_id -> proposal_outlines.solicitation_id) ==============
DROP POLICY IF EXISTS "view outline nodes" ON public.outline_nodes;
CREATE POLICY "view outline nodes" ON public.outline_nodes
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.proposal_outlines o
            WHERE o.id = outline_nodes.outline_id
              AND public.is_solicitation_member(auth.uid(), o.solicitation_id))
  );
DROP POLICY IF EXISTS "staff manage outline nodes" ON public.outline_nodes;
CREATE POLICY "staff manage outline nodes" ON public.outline_nodes
  FOR ALL USING (
    EXISTS (SELECT 1 FROM public.proposal_outlines o
            WHERE o.id = outline_nodes.outline_id
              AND public.is_solicitation_member(auth.uid(), o.solicitation_id))
  ) WITH CHECK (
    EXISTS (SELECT 1 FROM public.proposal_outlines o
            WHERE o.id = outline_nodes.outline_id
              AND public.is_solicitation_member(auth.uid(), o.solicitation_id))
  );

-- ============== annotations ==============
DROP POLICY IF EXISTS "view annotations" ON public.annotations;
CREATE POLICY "view annotations" ON public.annotations
  FOR SELECT USING (public.is_solicitation_member(auth.uid(), solicitation_id));
DROP POLICY IF EXISTS "manage own annotations" ON public.annotations;
CREATE POLICY "manage own annotations" ON public.annotations
  FOR ALL USING (
    public.is_solicitation_member(auth.uid(), solicitation_id)
    AND (user_id = auth.uid() OR public.is_solicitation_admin(auth.uid(), solicitation_id))
  ) WITH CHECK (
    public.is_solicitation_member(auth.uid(), solicitation_id)
    AND user_id = auth.uid()
  );

-- ============== Loop for tables with direct solicitation_id ==============
DO $$
DECLARE
  t text;
  tables text[] := ARRAY[
    'capability_gaps','opportunities','delta_runs','delta_actions',
    'executive_reports','proposal_outlines','activity_log','export_history',
    'risks','win_themes','strategic_questions','section_analyses','requirement_items'
  ];
  pol text;
BEGIN
  FOREACH t IN ARRAY tables LOOP
    FOR pol IN
      SELECT policyname FROM pg_policies
      WHERE schemaname='public' AND tablename=t
        AND (policyname LIKE 'view %' OR policyname LIKE 'staff manage %')
        AND policyname NOT LIKE '%client%'
    LOOP
      EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', pol, t);
    END LOOP;

    EXECUTE format($f$
      CREATE POLICY "view %1$s assigned" ON public.%1$I
        FOR SELECT USING (public.is_solicitation_member(auth.uid(), solicitation_id))
    $f$, t);

    EXECUTE format($f$
      CREATE POLICY "manage %1$s assigned" ON public.%1$I
        FOR ALL USING (public.is_solicitation_member(auth.uid(), solicitation_id))
        WITH CHECK (public.is_solicitation_member(auth.uid(), solicitation_id))
    $f$, t);
  END LOOP;
END $$;
