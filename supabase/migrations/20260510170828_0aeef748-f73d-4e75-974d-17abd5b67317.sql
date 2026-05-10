
-- Activity log table
CREATE TABLE IF NOT EXISTS public.activity_log (
  id UUID PRIMARY KEY DEFAULT extensions.uuid_generate_v4(),
  solicitation_id UUID NOT NULL REFERENCES public.solicitations(id) ON DELETE CASCADE,
  user_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
  event_type TEXT NOT NULL,
  event_description TEXT NOT NULL,
  entity_type TEXT,
  entity_id UUID,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_activity_log_solicitation ON public.activity_log(solicitation_id);
CREATE INDEX IF NOT EXISTS idx_activity_log_created ON public.activity_log(created_at DESC);

ALTER TABLE public.activity_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "view solicitation activity" ON public.activity_log;
CREATE POLICY "view solicitation activity"
ON public.activity_log
FOR SELECT
TO authenticated
USING (
  solicitation_id IN (
    SELECT s.id FROM public.solicitations s
    JOIN public.clients c ON c.id = s.client_id
    WHERE c.organization_id = public.current_user_org()
  )
);

-- Helper function to insert log entries
CREATE OR REPLACE FUNCTION public.log_activity(
  p_solicitation_id UUID,
  p_user_id UUID,
  p_event_type TEXT,
  p_event_description TEXT,
  p_entity_type TEXT DEFAULT NULL,
  p_entity_id UUID DEFAULT NULL,
  p_metadata JSONB DEFAULT '{}'::jsonb
) RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_id UUID;
BEGIN
  INSERT INTO public.activity_log(
    solicitation_id, user_id, event_type, event_description,
    entity_type, entity_id, metadata
  )
  VALUES (
    p_solicitation_id, p_user_id, p_event_type, p_event_description,
    p_entity_type, p_entity_id, COALESCE(p_metadata, '{}'::jsonb)
  )
  RETURNING id INTO v_id;
  RETURN v_id;
END;
$$;

-- Document upload trigger
CREATE OR REPLACE FUNCTION public.log_document_activity()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    PERFORM public.log_activity(
      NEW.solicitation_id,
      auth.uid(),
      'document_uploaded',
      'Document uploaded: ' || NEW.file_name,
      'document',
      NEW.id,
      jsonb_build_object('file_name', NEW.file_name, 'document_type', NEW.document_type)
    );
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trigger_log_document_upload ON public.documents;
CREATE TRIGGER trigger_log_document_upload
AFTER INSERT ON public.documents
FOR EACH ROW EXECUTE FUNCTION public.log_document_activity();

-- Annotation trigger
CREATE OR REPLACE FUNCTION public.log_annotation_activity()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    PERFORM public.log_activity(
      NEW.solicitation_id,
      NEW.user_id,
      'annotation_added',
      'Added ' || NEW.annotation_type::text || ' annotation',
      'annotation',
      NEW.id,
      jsonb_build_object(
        'annotation_type', NEW.annotation_type::text,
        'content_preview', LEFT(NEW.content, 120)
      )
    );
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trigger_log_annotation ON public.annotations;
CREATE TRIGGER trigger_log_annotation
AFTER INSERT ON public.annotations
FOR EACH ROW EXECUTE FUNCTION public.log_annotation_activity();

-- Solicitation status change trigger
CREATE OR REPLACE FUNCTION public.log_solicitation_status_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.status IS DISTINCT FROM OLD.status THEN
    PERFORM public.log_activity(
      NEW.id,
      auth.uid(),
      'status_changed',
      'Status changed to ' || NEW.status::text,
      'solicitation',
      NEW.id,
      jsonb_build_object('from', OLD.status::text, 'to', NEW.status::text)
    );
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trigger_log_solicitation_status ON public.solicitations;
CREATE TRIGGER trigger_log_solicitation_status
AFTER UPDATE OF status ON public.solicitations
FOR EACH ROW EXECUTE FUNCTION public.log_solicitation_status_change();

-- Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.activity_log;
ALTER PUBLICATION supabase_realtime ADD TABLE public.annotations;
ALTER TABLE public.activity_log REPLICA IDENTITY FULL;
ALTER TABLE public.annotations REPLICA IDENTITY FULL;
