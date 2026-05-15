ALTER TABLE public.strategic_questions
  ADD COLUMN IF NOT EXISTS synthesis_status text,
  ADD COLUMN IF NOT EXISTS synthesis_reason text,
  ADD COLUMN IF NOT EXISTS synthesis_merged_into uuid;

CREATE INDEX IF NOT EXISTS idx_strategic_questions_synthesis_status
  ON public.strategic_questions (solicitation_id, synthesis_status);