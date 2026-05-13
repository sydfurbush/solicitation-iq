CREATE TYPE public.writing_status AS ENUM ('not_started', 'drafting', 'pink_ready', 'red_ready', 'final');

ALTER TABLE public.outline_nodes
  ADD COLUMN writing_status public.writing_status NOT NULL DEFAULT 'not_started',
  ADD COLUMN due_date date NULL;

CREATE INDEX idx_outline_nodes_assigned_to ON public.outline_nodes(assigned_to);
CREATE INDEX idx_outline_nodes_writing_status ON public.outline_nodes(writing_status);