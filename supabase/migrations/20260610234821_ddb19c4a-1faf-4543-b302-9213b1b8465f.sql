
-- =========================
-- A. assistant_memory
-- =========================
CREATE TABLE public.assistant_memory (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  organization_id uuid REFERENCES public.organizations(id) ON DELETE SET NULL,
  fact text NOT NULL,
  source text NOT NULL DEFAULT 'explicit' CHECK (source IN ('explicit','auto')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX assistant_memory_user_idx ON public.assistant_memory(user_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.assistant_memory TO authenticated;
GRANT ALL ON public.assistant_memory TO service_role;

ALTER TABLE public.assistant_memory ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage their own memory"
  ON public.assistant_memory FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Org admins can read org memory"
  ON public.assistant_memory FOR SELECT
  USING (
    organization_id IS NOT NULL
    AND organization_id = public.current_user_org()
    AND public.is_org_admin(auth.uid())
  );

CREATE TRIGGER assistant_memory_updated_at
  BEFORE UPDATE ON public.assistant_memory
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- =========================
-- B. assistant_preferences
-- =========================
CREATE TABLE public.assistant_preferences (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  tone text NOT NULL DEFAULT 'professional',
  voice_replies boolean NOT NULL DEFAULT false,
  auto_learn boolean NOT NULL DEFAULT true,
  blocked_topics text[] NOT NULL DEFAULT '{}',
  default_persona text NOT NULL DEFAULT 'capture_manager',
  plain_mode_default boolean NOT NULL DEFAULT false,
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.assistant_preferences TO authenticated;
GRANT ALL ON public.assistant_preferences TO service_role;

ALTER TABLE public.assistant_preferences ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage their own preferences"
  ON public.assistant_preferences FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE TRIGGER assistant_preferences_updated_at
  BEFORE UPDATE ON public.assistant_preferences
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- =========================
-- C. assistant_threads — new columns
-- =========================
ALTER TABLE public.assistant_threads
  ADD COLUMN IF NOT EXISTS persona text NOT NULL DEFAULT 'capture_manager',
  ADD COLUMN IF NOT EXISTS plain_mode boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS pinned_client_id uuid REFERENCES public.clients(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS pinned_solicitation_id uuid REFERENCES public.solicitations(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS pinned_entity jsonb;

-- =========================
-- E. assistant_audit_log
-- =========================
CREATE TABLE public.assistant_audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  organization_id uuid REFERENCES public.organizations(id) ON DELETE SET NULL,
  thread_id uuid REFERENCES public.assistant_threads(id) ON DELETE SET NULL,
  message_id uuid REFERENCES public.assistant_messages(id) ON DELETE SET NULL,
  solicitation_id uuid REFERENCES public.solicitations(id) ON DELETE SET NULL,
  persona text,
  model text,
  tokens_in integer,
  tokens_out integer,
  latency_ms integer,
  status text NOT NULL DEFAULT 'ok',
  error text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX assistant_audit_log_org_created_idx
  ON public.assistant_audit_log(organization_id, created_at DESC);
CREATE INDEX assistant_audit_log_user_idx
  ON public.assistant_audit_log(user_id, created_at DESC);

GRANT SELECT ON public.assistant_audit_log TO authenticated;
GRANT ALL ON public.assistant_audit_log TO service_role;

ALTER TABLE public.assistant_audit_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Org admins read org audit log"
  ON public.assistant_audit_log FOR SELECT
  USING (
    organization_id = public.current_user_org()
    AND public.is_org_admin(auth.uid())
  );

CREATE POLICY "Users read their own audit rows"
  ON public.assistant_audit_log FOR SELECT
  USING (auth.uid() = user_id);

-- =========================
-- F. assistant_rate_limits + helper
-- =========================
CREATE TABLE public.assistant_rate_limits (
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  window_start timestamptz NOT NULL,
  request_count integer NOT NULL DEFAULT 0,
  PRIMARY KEY (user_id, window_start)
);

GRANT SELECT ON public.assistant_rate_limits TO authenticated;
GRANT ALL ON public.assistant_rate_limits TO service_role;

ALTER TABLE public.assistant_rate_limits ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users read their own rate limits"
  ON public.assistant_rate_limits FOR SELECT
  USING (auth.uid() = user_id);

CREATE OR REPLACE FUNCTION public.assistant_check_and_increment(
  p_user_id uuid,
  p_limit integer,
  p_window_seconds integer
)
RETURNS TABLE(allowed boolean, remaining integer, reset_at timestamptz)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_window_start timestamptz;
  v_count integer;
BEGIN
  v_window_start := date_trunc('second', now()) - (extract(epoch from now())::bigint % p_window_seconds) * interval '1 second';

  INSERT INTO public.assistant_rate_limits (user_id, window_start, request_count)
  VALUES (p_user_id, v_window_start, 1)
  ON CONFLICT (user_id, window_start)
  DO UPDATE SET request_count = public.assistant_rate_limits.request_count + 1
  RETURNING request_count INTO v_count;

  RETURN QUERY SELECT
    (v_count <= p_limit) AS allowed,
    GREATEST(p_limit - v_count, 0) AS remaining,
    (v_window_start + (p_window_seconds * interval '1 second')) AS reset_at;
END;
$$;

-- =========================
-- I. assistant_messages safety columns
-- =========================
ALTER TABLE public.assistant_messages
  ADD COLUMN IF NOT EXISTS safety_status text NOT NULL DEFAULT 'ok'
    CHECK (safety_status IN ('ok','redacted','refused')),
  ADD COLUMN IF NOT EXISTS safety_reason text,
  ADD COLUMN IF NOT EXISTS safety_topics text[] NOT NULL DEFAULT '{}';
