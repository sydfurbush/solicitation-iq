-- ===========================================================
-- Reports hub foundations: time_entries, user_rates,
-- solicitation_outcomes, aggregation views.
-- ===========================================================

-- 1. Outcome enum
DO $$ BEGIN
  CREATE TYPE public.outcome_status AS ENUM ('pending','won','lost','no_bid','withdrawn');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ===========================================================
-- TIME ENTRIES
-- ===========================================================
CREATE TABLE IF NOT EXISTS public.time_entries (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  solicitation_id uuid REFERENCES public.solicitations(id) ON DELETE SET NULL,
  phase           public.phase_type,
  entry_date      date NOT NULL DEFAULT CURRENT_DATE,
  hours           numeric(5,2) NOT NULL,
  notes           text,
  billable        boolean NOT NULL DEFAULT true,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT time_entries_hours_positive CHECK (hours > 0 AND hours <= 24)
);

CREATE INDEX IF NOT EXISTS idx_time_entries_user_date     ON public.time_entries(user_id, entry_date DESC);
CREATE INDEX IF NOT EXISTS idx_time_entries_sol_date      ON public.time_entries(solicitation_id, entry_date DESC);
CREATE INDEX IF NOT EXISTS idx_time_entries_org_date      ON public.time_entries(organization_id, entry_date DESC);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.time_entries TO authenticated;
GRANT ALL ON public.time_entries TO service_role;

ALTER TABLE public.time_entries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users read own time entries"
  ON public.time_entries FOR SELECT TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Admins read org time entries"
  ON public.time_entries FOR SELECT TO authenticated
  USING (public.is_org_admin(auth.uid()) AND organization_id = public.current_user_org());

CREATE POLICY "Users insert own time entries"
  ON public.time_entries FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid() AND organization_id = public.current_user_org());

CREATE POLICY "Users update own time entries"
  ON public.time_entries FOR UPDATE TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users delete own time entries"
  ON public.time_entries FOR DELETE TO authenticated
  USING (user_id = auth.uid());

CREATE TRIGGER trg_time_entries_updated_at
  BEFORE UPDATE ON public.time_entries
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- ===========================================================
-- USER RATES (effective-dated)
-- ===========================================================
CREATE TABLE IF NOT EXISTS public.user_rates (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id               uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  organization_id       uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  hourly_rate           numeric(10,2) NOT NULL DEFAULT 0,
  weekly_capacity_hours numeric(5,2)  NOT NULL DEFAULT 40,
  effective_from        date NOT NULL DEFAULT CURRENT_DATE,
  effective_to          date,
  created_at            timestamptz NOT NULL DEFAULT now(),
  updated_at            timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT user_rates_rate_nonneg CHECK (hourly_rate >= 0),
  CONSTRAINT user_rates_cap_nonneg  CHECK (weekly_capacity_hours >= 0),
  CONSTRAINT user_rates_range_valid CHECK (effective_to IS NULL OR effective_to >= effective_from)
);

CREATE INDEX IF NOT EXISTS idx_user_rates_user_effective  ON public.user_rates(user_id, effective_from DESC);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_rates TO authenticated;
GRANT ALL ON public.user_rates TO service_role;

ALTER TABLE public.user_rates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users read own rate"
  ON public.user_rates FOR SELECT TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Admins read org rates"
  ON public.user_rates FOR SELECT TO authenticated
  USING (public.is_org_admin(auth.uid()) AND organization_id = public.current_user_org());

CREATE POLICY "Admins write rates"
  ON public.user_rates FOR INSERT TO authenticated
  WITH CHECK (public.is_org_admin(auth.uid()) AND organization_id = public.current_user_org());

CREATE POLICY "Admins update rates"
  ON public.user_rates FOR UPDATE TO authenticated
  USING (public.is_org_admin(auth.uid()) AND organization_id = public.current_user_org())
  WITH CHECK (public.is_org_admin(auth.uid()) AND organization_id = public.current_user_org());

CREATE POLICY "Admins delete rates"
  ON public.user_rates FOR DELETE TO authenticated
  USING (public.is_org_admin(auth.uid()) AND organization_id = public.current_user_org());

CREATE TRIGGER trg_user_rates_updated_at
  BEFORE UPDATE ON public.user_rates
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- ===========================================================
-- SOLICITATION OUTCOMES (1:1 with solicitations)
-- ===========================================================
CREATE TABLE IF NOT EXISTS public.solicitation_outcomes (
  solicitation_id uuid PRIMARY KEY REFERENCES public.solicitations(id) ON DELETE CASCADE,
  outcome         public.outcome_status NOT NULL DEFAULT 'pending',
  awarded_value   numeric(14,2),
  awarded_at      date,
  notes           text,
  recorded_by     uuid REFERENCES public.users(id) ON DELETE SET NULL,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.solicitation_outcomes TO authenticated;
GRANT ALL ON public.solicitation_outcomes TO service_role;

ALTER TABLE public.solicitation_outcomes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members read outcome"
  ON public.solicitation_outcomes FOR SELECT TO authenticated
  USING (public.is_solicitation_member(auth.uid(), solicitation_id));

CREATE POLICY "Admins insert outcome"
  ON public.solicitation_outcomes FOR INSERT TO authenticated
  WITH CHECK (public.is_solicitation_admin(auth.uid(), solicitation_id));

CREATE POLICY "Admins update outcome"
  ON public.solicitation_outcomes FOR UPDATE TO authenticated
  USING (public.is_solicitation_admin(auth.uid(), solicitation_id))
  WITH CHECK (public.is_solicitation_admin(auth.uid(), solicitation_id));

CREATE POLICY "Admins delete outcome"
  ON public.solicitation_outcomes FOR DELETE TO authenticated
  USING (public.is_solicitation_admin(auth.uid(), solicitation_id));

CREATE TRIGGER trg_solicitation_outcomes_updated_at
  BEFORE UPDATE ON public.solicitation_outcomes
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- ===========================================================
-- AGGREGATION VIEWS (security_invoker — inherit caller's RLS)
-- ===========================================================

-- Pipeline by status/stage/phase for the caller's org
CREATE OR REPLACE VIEW public.v_pipeline_summary
WITH (security_invoker = on) AS
SELECT
  c.organization_id,
  s.status::text                                AS status,
  s.stage::text                                 AS stage,
  s.current_phase::text                         AS phase,
  s.client_id,
  COUNT(*)                                      AS solicitation_count,
  COALESCE(SUM(s.estimated_value_low), 0)       AS est_value_low_sum,
  COALESCE(SUM(s.estimated_value_high), 0)      AS est_value_high_sum
FROM public.solicitations s
JOIN public.clients c ON c.id = s.client_id
WHERE s.deleted_at IS NULL
GROUP BY c.organization_id, s.status, s.stage, s.current_phase, s.client_id;

GRANT SELECT ON public.v_pipeline_summary TO authenticated;

-- On-time submission rate (per client, per lead assignee, last 365 days)
-- "Submitted on time" = status in (phase_3_active, complete, archived) AND
-- updated_at <= proposal_due_date. Approximate, since we don't have a real submitted_at.
CREATE OR REPLACE VIEW public.v_ontime_rate
WITH (security_invoker = on) AS
WITH sols AS (
  SELECT
    s.id,
    c.organization_id,
    s.client_id,
    s.proposal_due_date,
    s.updated_at,
    s.status::text AS status,
    (SELECT user_id FROM public.solicitation_assignments
       WHERE solicitation_id = s.id AND role = 'lead' LIMIT 1) AS lead_user_id
  FROM public.solicitations s
  JOIN public.clients c ON c.id = s.client_id
  WHERE s.deleted_at IS NULL
    AND s.proposal_due_date IS NOT NULL
    AND s.proposal_due_date >= now() - interval '365 days'
)
SELECT
  organization_id,
  client_id,
  lead_user_id,
  COUNT(*) FILTER (WHERE status IN ('complete','archived','phase_3_active'))                                            AS submitted_count,
  COUNT(*) FILTER (WHERE status IN ('complete','archived','phase_3_active') AND updated_at <= proposal_due_date)         AS on_time_count,
  COUNT(*)                                                                                                              AS total_count
FROM sols
GROUP BY organization_id, client_id, lead_user_id;

GRANT SELECT ON public.v_ontime_rate TO authenticated;

-- Per-user workload & utilization for the caller's org
CREATE OR REPLACE VIEW public.v_user_workload
WITH (security_invoker = on) AS
SELECT
  u.id                                  AS user_id,
  u.organization_id,
  u.full_name,
  u.email,
  COALESCE(act.active_count, 0)         AS active_assignments,
  COALESCE(overdue.overdue_count, 0)    AS overdue_items,
  COALESCE(te.hours_30d, 0)             AS hours_logged_30d,
  COALESCE(te.cost_30d, 0)              AS cost_30d,
  COALESCE(act7.activity_7d, 0)         AS activity_7d,
  COALESCE(r.weekly_capacity_hours, 40) AS weekly_capacity_hours,
  COALESCE(r.hourly_rate, 0)            AS hourly_rate
FROM public.users u
LEFT JOIN LATERAL (
  SELECT weekly_capacity_hours, hourly_rate
  FROM public.user_rates
  WHERE user_id = u.id
    AND effective_from <= CURRENT_DATE
    AND (effective_to IS NULL OR effective_to >= CURRENT_DATE)
  ORDER BY effective_from DESC LIMIT 1
) r ON TRUE
LEFT JOIN LATERAL (
  SELECT COUNT(*) AS active_count
  FROM public.solicitation_assignments sa
  JOIN public.solicitations s ON s.id = sa.solicitation_id
  WHERE sa.user_id = u.id
    AND s.deleted_at IS NULL
    AND s.status NOT IN ('complete','archived')
) act ON TRUE
LEFT JOIN LATERAL (
  SELECT COUNT(*) AS overdue_count
  FROM public.solicitation_assignments sa
  JOIN public.solicitations s ON s.id = sa.solicitation_id
  WHERE sa.user_id = u.id
    AND s.deleted_at IS NULL
    AND s.proposal_due_date IS NOT NULL
    AND s.proposal_due_date < now()
    AND s.status NOT IN ('complete','archived')
) overdue ON TRUE
LEFT JOIN LATERAL (
  SELECT
    SUM(te.hours)                                                                AS hours_30d,
    SUM(te.hours * COALESCE(rr.hourly_rate, 0))                                  AS cost_30d
  FROM public.time_entries te
  LEFT JOIN LATERAL (
    SELECT hourly_rate FROM public.user_rates
    WHERE user_id = te.user_id
      AND effective_from <= te.entry_date
      AND (effective_to IS NULL OR effective_to >= te.entry_date)
    ORDER BY effective_from DESC LIMIT 1
  ) rr ON TRUE
  WHERE te.user_id = u.id
    AND te.entry_date >= CURRENT_DATE - 30
) te ON TRUE
LEFT JOIN LATERAL (
  SELECT COUNT(*) AS activity_7d
  FROM public.activity_log
  WHERE user_id = u.id
    AND created_at >= now() - interval '7 days'
) act7 ON TRUE
WHERE u.organization_id IS NOT NULL;

GRANT SELECT ON public.v_user_workload TO authenticated;

-- Per-client portfolio summary
CREATE OR REPLACE VIEW public.v_client_portfolio
WITH (security_invoker = on) AS
SELECT
  c.id              AS client_id,
  c.organization_id,
  c.name            AS client_name,
  COUNT(s.id) FILTER (WHERE s.deleted_at IS NULL)                                                AS solicitation_count,
  COUNT(s.id) FILTER (WHERE s.deleted_at IS NULL AND s.status NOT IN ('complete','archived'))    AS active_count,
  COALESCE(SUM(s.estimated_value_high) FILTER (WHERE s.deleted_at IS NULL), 0)                   AS total_est_value,
  COUNT(o.solicitation_id) FILTER (WHERE o.outcome = 'won')                                      AS won_count,
  COUNT(o.solicitation_id) FILTER (WHERE o.outcome = 'lost')                                     AS lost_count,
  COUNT(o.solicitation_id) FILTER (WHERE o.outcome = 'no_bid')                                   AS no_bid_count,
  COALESCE(SUM(o.awarded_value) FILTER (WHERE o.outcome = 'won'), 0)                             AS awarded_value_total,
  COALESCE(cost.total_cost, 0)                                                                   AS cost_to_bid_total
FROM public.clients c
LEFT JOIN public.solicitations s ON s.client_id = c.id
LEFT JOIN public.solicitation_outcomes o ON o.solicitation_id = s.id
LEFT JOIN LATERAL (
  SELECT SUM(te.hours * COALESCE(rr.hourly_rate, 0)) AS total_cost
  FROM public.time_entries te
  LEFT JOIN LATERAL (
    SELECT hourly_rate FROM public.user_rates
    WHERE user_id = te.user_id
      AND effective_from <= te.entry_date
      AND (effective_to IS NULL OR effective_to >= te.entry_date)
    ORDER BY effective_from DESC LIMIT 1
  ) rr ON TRUE
  WHERE te.solicitation_id IN (SELECT id FROM public.solicitations WHERE client_id = c.id)
) cost ON TRUE
GROUP BY c.id, c.organization_id, c.name, cost.total_cost;

GRANT SELECT ON public.v_client_portfolio TO authenticated;