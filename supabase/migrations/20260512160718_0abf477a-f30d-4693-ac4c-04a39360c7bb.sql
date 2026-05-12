-- Stage enum + solicitations columns
DO $$ BEGIN
  CREATE TYPE public.solicitation_stage AS ENUM ('pre_solicitation','draft_rfp','final','amendment');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

ALTER TABLE public.solicitations
  ADD COLUMN IF NOT EXISTS stage public.solicitation_stage NOT NULL DEFAULT 'final',
  ADD COLUMN IF NOT EXISTS stage_label text,
  ADD COLUMN IF NOT EXISTS parent_solicitation_id uuid REFERENCES public.solicitations(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_solicitations_parent ON public.solicitations(parent_solicitation_id);
CREATE INDEX IF NOT EXISTS idx_solicitations_client_parent ON public.solicitations(client_id, parent_solicitation_id);

-- Snapshots
CREATE TABLE IF NOT EXISTS public.solicitation_snapshots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  solicitation_id uuid NOT NULL REFERENCES public.solicitations(id) ON DELETE CASCADE,
  snapshot_label text NOT NULL,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_snapshots_solicitation ON public.solicitation_snapshots(solicitation_id);
ALTER TABLE public.solicitation_snapshots ENABLE ROW LEVEL SECURITY;

CREATE POLICY "staff manage snapshots" ON public.solicitation_snapshots
  FOR ALL TO authenticated
  USING (is_org_staff(auth.uid()) AND solicitation_id IN (
    SELECT s.id FROM solicitations s JOIN clients c ON c.id = s.client_id
    WHERE c.organization_id = current_user_org()))
  WITH CHECK (is_org_staff(auth.uid()) AND solicitation_id IN (
    SELECT s.id FROM solicitations s JOIN clients c ON c.id = s.client_id
    WHERE c.organization_id = current_user_org()));

CREATE POLICY "view snapshots" ON public.solicitation_snapshots
  FOR SELECT TO authenticated
  USING (solicitation_id IN (
    SELECT s.id FROM solicitations s JOIN clients c ON c.id = s.client_id
    WHERE c.organization_id = current_user_org()));

CREATE POLICY "client view snapshots" ON public.solicitation_snapshots
  FOR SELECT TO authenticated
  USING (solicitation_id IN (
    SELECT s.id FROM solicitations s JOIN clients c ON c.id = s.client_id
    WHERE c.id = current_client_id() AND c.access_level = 'full'));

-- Delta runs
CREATE TABLE IF NOT EXISTS public.delta_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  solicitation_id uuid NOT NULL REFERENCES public.solicitations(id) ON DELETE CASCADE,
  prior_solicitation_id uuid REFERENCES public.solicitations(id) ON DELETE SET NULL,
  status text NOT NULL DEFAULT 'running',
  current_step text,
  total_batches int NOT NULL DEFAULT 0,
  completed_batches int NOT NULL DEFAULT 0,
  failed_batches int NOT NULL DEFAULT 0,
  error_message text,
  started_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz,
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_delta_runs_sol ON public.delta_runs(solicitation_id);
ALTER TABLE public.delta_runs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "staff manage delta runs" ON public.delta_runs
  FOR ALL TO authenticated
  USING (is_org_staff(auth.uid()) AND solicitation_id IN (
    SELECT s.id FROM solicitations s JOIN clients c ON c.id = s.client_id
    WHERE c.organization_id = current_user_org()))
  WITH CHECK (is_org_staff(auth.uid()) AND solicitation_id IN (
    SELECT s.id FROM solicitations s JOIN clients c ON c.id = s.client_id
    WHERE c.organization_id = current_user_org()));

CREATE POLICY "view delta runs" ON public.delta_runs
  FOR SELECT TO authenticated
  USING (solicitation_id IN (
    SELECT s.id FROM solicitations s JOIN clients c ON c.id = s.client_id
    WHERE c.organization_id = current_user_org()));

-- Delta actions
CREATE TABLE IF NOT EXISTS public.delta_actions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  solicitation_id uuid NOT NULL REFERENCES public.solicitations(id) ON DELETE CASCADE,
  prior_solicitation_id uuid REFERENCES public.solicitations(id) ON DELETE SET NULL,
  delta_run_id uuid REFERENCES public.delta_runs(id) ON DELETE SET NULL,
  entity_type text NOT NULL,
  entity_id uuid,
  change_category text,
  change_ref jsonb NOT NULL DEFAULT '{}'::jsonb,
  recommended_action text NOT NULL DEFAULT 'review',
  priority text NOT NULL DEFAULT 'medium',
  status text NOT NULL DEFAULT 'open',
  title text NOT NULL,
  description text,
  note text,
  assigned_to uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_delta_actions_sol ON public.delta_actions(solicitation_id);
CREATE INDEX IF NOT EXISTS idx_delta_actions_status ON public.delta_actions(solicitation_id, status);
ALTER TABLE public.delta_actions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "staff manage delta actions" ON public.delta_actions
  FOR ALL TO authenticated
  USING (is_org_staff(auth.uid()) AND solicitation_id IN (
    SELECT s.id FROM solicitations s JOIN clients c ON c.id = s.client_id
    WHERE c.organization_id = current_user_org()))
  WITH CHECK (is_org_staff(auth.uid()) AND solicitation_id IN (
    SELECT s.id FROM solicitations s JOIN clients c ON c.id = s.client_id
    WHERE c.organization_id = current_user_org()));

CREATE POLICY "view delta actions" ON public.delta_actions
  FOR SELECT TO authenticated
  USING (solicitation_id IN (
    SELECT s.id FROM solicitations s JOIN clients c ON c.id = s.client_id
    WHERE c.organization_id = current_user_org()));

CREATE POLICY "client view delta actions" ON public.delta_actions
  FOR SELECT TO authenticated
  USING (solicitation_id IN (
    SELECT s.id FROM solicitations s JOIN clients c ON c.id = s.client_id
    WHERE c.id = current_client_id() AND c.access_level = 'full'));

-- updated_at triggers
DROP TRIGGER IF EXISTS trg_delta_runs_updated ON public.delta_runs;
CREATE TRIGGER trg_delta_runs_updated BEFORE UPDATE ON public.delta_runs
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

DROP TRIGGER IF EXISTS trg_delta_actions_updated ON public.delta_actions;
CREATE TRIGGER trg_delta_actions_updated BEFORE UPDATE ON public.delta_actions
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- Clone helper: copies a solicitation row with new stage + parent link.
-- Copies metadata only by default (Final ingestion regenerates analysis).
CREATE OR REPLACE FUNCTION public.clone_solicitation_for_stage(
  p_source_id uuid,
  p_new_stage public.solicitation_stage,
  p_stage_label text DEFAULT NULL,
  p_new_title text DEFAULT NULL
) RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_new_id uuid;
  v_org uuid;
  v_source_org uuid;
BEGIN
  v_org := current_user_org();
  SELECT c.organization_id INTO v_source_org
  FROM solicitations s JOIN clients c ON c.id = s.client_id
  WHERE s.id = p_source_id;

  IF v_source_org IS NULL OR v_source_org <> v_org THEN
    RAISE EXCEPTION 'not authorized';
  END IF;

  INSERT INTO solicitations (
    client_id, title, solicitation_number, issuing_agency, agency_type,
    release_date, questions_due_date, proposal_due_date, expected_award_date,
    period_of_performance_start, period_of_performance_end,
    estimated_value_low, estimated_value_high, contract_type,
    has_incumbent, incumbent_name, incumbent_contract_number, incumbent_contract_value, incumbent_performance_notes,
    status, current_phase, tags, metadata, set_aside, sam_url,
    stage, stage_label, parent_solicitation_id
  )
  SELECT
    client_id, COALESCE(p_new_title, title), solicitation_number, issuing_agency, agency_type,
    release_date, questions_due_date, proposal_due_date, expected_award_date,
    period_of_performance_start, period_of_performance_end,
    estimated_value_low, estimated_value_high, contract_type,
    has_incumbent, incumbent_name, incumbent_contract_number, incumbent_contract_value, incumbent_performance_notes,
    'intake'::solicitation_status, 'phase_1_initial'::phase_type, tags, metadata, set_aside, sam_url,
    p_new_stage, p_stage_label, p_source_id
  FROM solicitations WHERE id = p_source_id
  RETURNING id INTO v_new_id;

  RETURN v_new_id;
END;
$$;