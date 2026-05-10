CREATE OR REPLACE FUNCTION public.create_report_version()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'UPDATE' AND OLD.content IS DISTINCT FROM NEW.content THEN
    NEW.version = COALESCE(OLD.version, 1) + 1;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trigger_report_version ON public.executive_reports;
CREATE TRIGGER trigger_report_version
  BEFORE UPDATE ON public.executive_reports
  FOR EACH ROW EXECUTE FUNCTION public.create_report_version();