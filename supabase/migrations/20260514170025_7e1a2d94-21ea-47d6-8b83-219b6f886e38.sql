
-- Enums
CREATE TYPE public.client_question_decision AS ENUM ('pending','remove','clarify','hold','deferred');
CREATE TYPE public.clarification_item_status AS ENUM ('none','drafting','ready','submitted');
CREATE TYPE public.clarification_package_status AS ENUM ('draft','ready','submitted');

-- Columns on strategic_questions
ALTER TABLE public.strategic_questions
  ADD COLUMN client_decision public.client_question_decision NOT NULL DEFAULT 'pending',
  ADD COLUMN client_note text,
  ADD COLUMN client_decision_by uuid REFERENCES public.client_users(id) ON DELETE SET NULL,
  ADD COLUMN client_decided_at timestamptz,
  ADD COLUMN clarification_draft text,
  ADD COLUMN clarification_status public.clarification_item_status NOT NULL DEFAULT 'none',
  ADD COLUMN clarification_package_id uuid;

CREATE INDEX idx_strategic_questions_client_decision
  ON public.strategic_questions(solicitation_id, client_decision);

-- Clarification packages table
CREATE TABLE public.clarification_packages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  solicitation_id uuid NOT NULL REFERENCES public.solicitations(id) ON DELETE CASCADE,
  status public.clarification_package_status NOT NULL DEFAULT 'draft',
  pdf_path text,
  docx_path text,
  notes text,
  compiled_by uuid REFERENCES public.users(id) ON DELETE SET NULL,
  compiled_at timestamptz,
  submitted_at timestamptz,
  submitted_by uuid REFERENCES public.client_users(id) ON DELETE SET NULL,
  submission_reference text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_clarification_packages_sol ON public.clarification_packages(solicitation_id);

ALTER TABLE public.strategic_questions
  ADD CONSTRAINT strategic_questions_clarification_package_fk
  FOREIGN KEY (clarification_package_id)
  REFERENCES public.clarification_packages(id) ON DELETE SET NULL;

ALTER TABLE public.clarification_packages ENABLE ROW LEVEL SECURITY;

CREATE TRIGGER trg_clarification_packages_updated
  BEFORE UPDATE ON public.clarification_packages
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- RLS: analysts/admins assigned to the solicitation manage everything
CREATE POLICY "staff manage clarification packages"
  ON public.clarification_packages
  FOR ALL TO authenticated
  USING (public.is_solicitation_member(auth.uid(), solicitation_id))
  WITH CHECK (public.is_solicitation_member(auth.uid(), solicitation_id));

-- RLS: client users (full access) can read packages for their solicitations
CREATE POLICY "client view clarification packages"
  ON public.clarification_packages
  FOR SELECT TO authenticated
  USING (
    solicitation_id IN (
      SELECT s.id
      FROM public.solicitations s
      JOIN public.clients c ON c.id = s.client_id
      WHERE c.id = public.current_client_id()
        AND c.access_level = 'full'::public.client_access_level
    )
  );

-- RLS: client users can update submission fields on packages for their solicitations
CREATE POLICY "client submit clarification packages"
  ON public.clarification_packages
  FOR UPDATE TO authenticated
  USING (
    solicitation_id IN (
      SELECT s.id
      FROM public.solicitations s
      JOIN public.clients c ON c.id = s.client_id
      WHERE c.id = public.current_client_id()
        AND c.access_level = 'full'::public.client_access_level
    )
  )
  WITH CHECK (
    solicitation_id IN (
      SELECT s.id
      FROM public.solicitations s
      JOIN public.clients c ON c.id = s.client_id
      WHERE c.id = public.current_client_id()
        AND c.access_level = 'full'::public.client_access_level
    )
  );

-- Trigger that prevents client users from editing analyst-only fields on strategic_questions.
-- Client users may only update decision fields and the question text/note (per plan section 3 inline edit allowance).
CREATE OR REPLACE FUNCTION public.guard_client_question_update()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_is_client boolean;
BEGIN
  v_is_client := public.is_client_user(auth.uid());
  IF NOT v_is_client THEN
    RETURN NEW;
  END IF;

  -- Client users can only modify these columns:
  IF NEW.solicitation_id IS DISTINCT FROM OLD.solicitation_id
     OR NEW.category IS DISTINCT FROM OLD.category
     OR NEW.recommendation IS DISTINCT FROM OLD.recommendation
     OR NEW.priority IS DISTINCT FROM OLD.priority
     OR NEW.source_document_id IS DISTINCT FROM OLD.source_document_id
     OR NEW.source_section_id IS DISTINCT FROM OLD.source_section_id
     OR NEW.source_citation IS DISTINCT FROM OLD.source_citation
     OR NEW.source_quote IS DISTINCT FROM OLD.source_quote
     OR NEW.strategic_advantage_notes IS DISTINCT FROM OLD.strategic_advantage_notes
     OR NEW.potential_answer_insight IS DISTINCT FROM OLD.potential_answer_insight
     OR NEW.is_ai_generated IS DISTINCT FROM OLD.is_ai_generated
     OR NEW.is_submitted IS DISTINCT FROM OLD.is_submitted
     OR NEW.submitted_at IS DISTINCT FROM OLD.submitted_at
     OR NEW.agency_response IS DISTINCT FROM OLD.agency_response
     OR NEW.created_by IS DISTINCT FROM OLD.created_by
     OR NEW.clarification_draft IS DISTINCT FROM OLD.clarification_draft
     OR NEW.clarification_status IS DISTINCT FROM OLD.clarification_status
     OR NEW.clarification_package_id IS DISTINCT FROM OLD.clarification_package_id
  THEN
    RAISE EXCEPTION 'Client users may only edit decision and question text fields on strategic_questions';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_guard_client_question_update
  BEFORE UPDATE ON public.strategic_questions
  FOR EACH ROW EXECUTE FUNCTION public.guard_client_question_update();

-- RLS: client users (full access) can update questions on their solicitations (column scope enforced by trigger)
CREATE POLICY "client update questions"
  ON public.strategic_questions
  FOR UPDATE TO authenticated
  USING (
    solicitation_id IN (
      SELECT s.id
      FROM public.solicitations s
      JOIN public.clients c ON c.id = s.client_id
      WHERE c.id = public.current_client_id()
        AND c.access_level = 'full'::public.client_access_level
    )
  )
  WITH CHECK (
    solicitation_id IN (
      SELECT s.id
      FROM public.solicitations s
      JOIN public.clients c ON c.id = s.client_id
      WHERE c.id = public.current_client_id()
        AND c.access_level = 'full'::public.client_access_level
    )
  );
