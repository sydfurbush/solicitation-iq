ALTER TYPE public.question_category ADD VALUE IF NOT EXISTS 'drafting_error';
ALTER TYPE public.question_category ADD VALUE IF NOT EXISTS 'contradiction';
ALTER TYPE public.question_category ADD VALUE IF NOT EXISTS 'quantitative_gap';