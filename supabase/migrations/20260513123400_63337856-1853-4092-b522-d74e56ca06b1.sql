
-- Enum for revision kind
DO $$ BEGIN
  CREATE TYPE public.revision_kind AS ENUM ('pre_sol','amendment','final','draft','other');
EXCEPTION WHEN duplicate_object THEN null; END $$;

-- Revisions table
CREATE TABLE IF NOT EXISTS public.solicitation_revisions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  solicitation_id uuid NOT NULL REFERENCES public.solicitations(id) ON DELETE CASCADE,
  label text NOT NULL,
  kind public.revision_kind NOT NULL DEFAULT 'other',
  sequence integer NOT NULL DEFAULT 0,
  source text NOT NULL DEFAULT 'manual',
  sam_notice_id text,
  received_at timestamptz NOT NULL DEFAULT now(),
  notes text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_solicitation_revisions_sol ON public.solicitation_revisions(solicitation_id, sequence);

ALTER TABLE public.solicitation_revisions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "view solicitation revisions" ON public.solicitation_revisions;
CREATE POLICY "view solicitation revisions" ON public.solicitation_revisions
  FOR SELECT TO authenticated
  USING (solicitation_id IN (
    SELECT s.id FROM solicitations s JOIN clients c ON c.id = s.client_id
    WHERE c.organization_id = current_user_org()
  ));

DROP POLICY IF EXISTS "staff manage solicitation revisions" ON public.solicitation_revisions;
CREATE POLICY "staff manage solicitation revisions" ON public.solicitation_revisions
  FOR ALL TO authenticated
  USING (is_org_staff(auth.uid()) AND solicitation_id IN (
    SELECT s.id FROM solicitations s JOIN clients c ON c.id = s.client_id
    WHERE c.organization_id = current_user_org()
  ))
  WITH CHECK (is_org_staff(auth.uid()) AND solicitation_id IN (
    SELECT s.id FROM solicitations s JOIN clients c ON c.id = s.client_id
    WHERE c.organization_id = current_user_org()
  ));

DROP TRIGGER IF EXISTS trg_solicitation_revisions_updated ON public.solicitation_revisions;
CREATE TRIGGER trg_solicitation_revisions_updated
  BEFORE UPDATE ON public.solicitation_revisions
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- Add revision_id to documents
ALTER TABLE public.documents ADD COLUMN IF NOT EXISTS revision_id uuid REFERENCES public.solicitation_revisions(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_documents_revision ON public.documents(revision_id);

-- Add revision pair to prior_solicitations cache
ALTER TABLE public.prior_solicitations
  ADD COLUMN IF NOT EXISTS revision_a_id uuid REFERENCES public.solicitation_revisions(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS revision_b_id uuid REFERENCES public.solicitation_revisions(id) ON DELETE CASCADE;
CREATE INDEX IF NOT EXISTS idx_prior_solicitations_pair ON public.prior_solicitations(solicitation_id, revision_a_id, revision_b_id);

-- Backfill: create one "Initial" revision per solicitation that has documents but no revision rows yet
INSERT INTO public.solicitation_revisions (solicitation_id, label, kind, sequence, source, received_at)
SELECT DISTINCT s.id, 'Initial', 'pre_sol'::revision_kind, 0, 'backfill', s.created_at
FROM public.solicitations s
WHERE NOT EXISTS (SELECT 1 FROM public.solicitation_revisions r WHERE r.solicitation_id = s.id);

-- Assign all existing documents without a revision to that initial revision
UPDATE public.documents d
SET revision_id = r.id
FROM public.solicitation_revisions r
WHERE r.solicitation_id = d.solicitation_id
  AND r.sequence = 0
  AND d.revision_id IS NULL;
