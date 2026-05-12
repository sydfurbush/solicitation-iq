ALTER TABLE public.section_analyses
  ADD COLUMN IF NOT EXISTS importance_score smallint CHECK (importance_score BETWEEN 1 AND 5),
  ADD COLUMN IF NOT EXISTS importance_rationale text,
  ADD COLUMN IF NOT EXISTS weight_source text CHECK (weight_source IN ('stated','inferred'));