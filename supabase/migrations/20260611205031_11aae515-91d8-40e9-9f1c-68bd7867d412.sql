
-- 1) Collapse data
UPDATE public.solicitations
   SET current_phase = 'phase_3_outline'::phase_type
 WHERE current_phase IN ('phase_4_win_themes'::phase_type, 'phase_5_drafting'::phase_type);

DELETE FROM public.solicitation_phases
 WHERE phase IN ('phase_4_win_themes'::phase_type,'phase_5_drafting'::phase_type);

UPDATE public.phase_approvals
   SET phase = 'phase_3_outline'::phase_type
 WHERE phase IN ('phase_4_win_themes'::phase_type,'phase_5_drafting'::phase_type);

UPDATE public.solicitations
   SET status = 'phase_3_active'::solicitation_status
 WHERE status = 'phase_4_active'::solicitation_status;

-- 2) Drop dependent trigger before altering status column
DROP TRIGGER IF EXISTS trigger_log_solicitation_status ON public.solicitations;

-- 3) Replace phase_type enum
ALTER TYPE public.phase_type RENAME TO phase_type_old;
CREATE TYPE public.phase_type AS ENUM ('phase_1_initial','phase_2_deep_dive','phase_3_outline');

ALTER TABLE public.solicitations       ALTER COLUMN current_phase DROP DEFAULT;
ALTER TABLE public.solicitation_phases ALTER COLUMN phase DROP DEFAULT;
ALTER TABLE public.phase_approvals     ALTER COLUMN phase DROP DEFAULT;

ALTER TABLE public.solicitations
  ALTER COLUMN current_phase TYPE public.phase_type USING current_phase::text::public.phase_type;
ALTER TABLE public.solicitation_phases
  ALTER COLUMN phase TYPE public.phase_type USING phase::text::public.phase_type;
ALTER TABLE public.phase_approvals
  ALTER COLUMN phase TYPE public.phase_type USING phase::text::public.phase_type;

ALTER TABLE public.solicitations
  ALTER COLUMN current_phase SET DEFAULT 'phase_1_initial'::public.phase_type;

DROP TYPE public.phase_type_old;

-- 4) Replace solicitation_status enum
ALTER TYPE public.solicitation_status RENAME TO solicitation_status_old;
CREATE TYPE public.solicitation_status AS ENUM (
  'intake','processing','phase_1_complete','phase_2_active','phase_3_active','complete','archived'
);

ALTER TABLE public.solicitations ALTER COLUMN status DROP DEFAULT;
ALTER TABLE public.solicitations
  ALTER COLUMN status TYPE public.solicitation_status
  USING status::text::public.solicitation_status;
ALTER TABLE public.solicitations
  ALTER COLUMN status SET DEFAULT 'intake'::public.solicitation_status;

DROP TYPE public.solicitation_status_old;

-- 5) Recreate the status-change activity trigger
CREATE TRIGGER trigger_log_solicitation_status
AFTER UPDATE OF status ON public.solicitations
FOR EACH ROW EXECUTE FUNCTION public.log_solicitation_status_change();
