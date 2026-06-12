## Global Reports — `/reports` rebuild

Replace the `ComingSoon` placeholder with a real, tabbed Reports hub serving both internal leadership and (read-only) client-facing audiences. Add the data foundations the app is missing today so cost and utilization reports are accurate, not estimated.

### Audience & visibility
- **Internal staff** (owner/admin/analyst): all tabs, all metrics.
- **Viewer role**: read-only access to everything they can already see.
- **Client portal users**: a stripped-down Portfolio view is added later in the portal (out of scope for this milestone — flagged below).

### Tab structure on `/reports`

```text
+------------------------------------------------------------------+
|  Reports                                          [PDF tools v]  |
+------------------------------------------------------------------+
|  [ Operations ]  [ Deliverables ]  [ Client Portfolio ]          |
|------------------------------------------------------------------|
|  Filters: client v   date range v   stage v   assignee v         |
|------------------------------------------------------------------|
|  ... cards / tables for the active tab ...                       |
+------------------------------------------------------------------+
```

**Tab 1 — Operations** (4 cards, all org-scoped):
1. **Pipeline overview** — solicitations grouped by stage/phase/status with counts and total estimated value; click-through to filtered Solicitations list.
2. **On-time submission rate** — % of solicitations submitted on/before `proposal_due_date`, broken down by client and lead assignee; trailing 90-day trend.
3. **Team workload & utilization** — per-user table: active assignments, overdue items, hours logged (last 30d), 7-day activity volume, utilization % (logged ÷ capacity).
4. **Client portfolio summary** — counts, total estimated value, win rate, cost-to-bid, net contribution per client.

**Tab 2 — Deliverables Library** — cross-solicitation rollup of every `executive_reports` row the user can see. Sortable/filterable table (date, type, client, solicitation, generated_by). Click a row → existing `ReportViewer`. "Open in solicitation" link.

**Tab 3 — Client Portfolio** — one card per client: active solicitations, upcoming due dates (next 30d), recent deliverables, last activity, total bid value, win/loss tally, cost-to-bid. Each card has "Generate client status report" → new "Client Portfolio" report type.

### New data foundations

Three new tables + one column added to `solicitations`. RLS scoped via `current_user_org()` and `is_solicitation_member` patterns already in use.

```text
time_entries
  user_id, solicitation_id, phase (nullable),
  entry_date, hours numeric(5,2), notes, billable bool

user_rates
  user_id, organization_id, hourly_rate numeric(10,2),
  effective_from date, effective_to date (nullable)

solicitation_outcomes              -- 1:1 with solicitations
  solicitation_id PK, outcome enum('won','lost','no_bid','withdrawn','pending'),
  awarded_value numeric, awarded_at date, notes

solicitations
  + weekly_capacity_hours numeric  -- optional; default 40 on user_rates instead
```

`user_rates` also stores **weekly capacity hours** so utilization = logged ÷ capacity. Cost-to-bid = Σ(hours × rate effective on `entry_date`) per solicitation. Win rate = `won / (won+lost+no_bid)` over a date window.

### Time tracking UI (minimum to populate the data)
- New **"Log time"** button on every solicitation header → drawer that picks phase, hours, date, notes; pre-fills today.
- New **`/profile/rates`** page for owners/admins to set hourly_rate and capacity per teammate (effective-dated).
- New **Outcome** widget on `SolicitationDetail` to mark won/lost/no_bid/withdrawn with awarded value/date.

### Reuse vs. new
- Reuse `useReports`, `ReportCard`, `ReportViewer`, `ReportTypeSelector`, `PdfToolsMenu`, `pdfKit`, `slugifyFilename`.
- New report type `client_portfolio` added to `REPORT_TYPES`; new generator section in `generate-report` edge function.
- All ops cards are React Query reads against new aggregation SQL views (`v_pipeline_summary`, `v_ontime_rate`, `v_user_workload`, `v_client_portfolio`) for predictable RLS and easy reuse.

### Technical details

Stack & conventions: React Query + Supabase client; Tailwind/shadcn cards; existing `tabs` component; charts via existing `recharts` if needed.

Migration outline (single migration, ordered: CREATE TABLE → GRANT → ENABLE RLS → CREATE POLICY):
- `time_entries` — RLS: users insert/update/delete own rows; org admins read all in org; viewers read own.
- `user_rates` — RLS: only owner/admin can insert/update; all org members can read their own row.
- `solicitation_outcomes` — RLS: `is_solicitation_member` for read, `is_solicitation_admin` for write.
- `outcome_status` enum.
- SECURITY DEFINER aggregation views (`v_*`) scoped by `current_user_org()`.

Files added:
- `src/pages/Reports.tsx` (replaced — tabs + filter bar)
- `src/features/reports-hub/components/{OperationsTab,DeliverablesTab,ClientPortfolioTab,PipelineCard,OnTimeCard,WorkloadCard,ClientSummaryCard,ReportsFilters}.tsx`
- `src/features/reports-hub/hooks/{usePipeline,useOnTimeRate,useWorkload,useClientPortfolio,useDeliverablesLibrary}.ts`
- `src/features/time/components/{LogTimeButton,LogTimeDrawer}.tsx`
- `src/features/time/hooks/{useTimeEntries,useUserRates}.ts`
- `src/features/outcomes/components/OutcomeWidget.tsx`
- `src/features/outcomes/hooks/useSolicitationOutcome.ts`
- `src/features/reports/templates/types.ts` — add `client_portfolio`
- `supabase/functions/generate-report/index.ts` — add client_portfolio renderer

Files edited:
- `src/components/layout/AppSidebar.tsx` — Reports already linked, no change.
- `src/pages/SolicitationDetail.tsx` — mount `LogTimeButton` + `OutcomeWidget`.
- `src/pages/Profile.tsx` (or new `/settings/rates`) — rates editor.

### Out of scope for this milestone
- Client-portal Portfolio surfacing for end-clients (separate task).
- Approval/locking of time entries, exports to QuickBooks/payroll.
- Automated reminders for missing time.
- Real-time charts; v1 uses static range queries.

### Acceptance
- `/reports` shows three tabs with data, not "Coming soon".
- Logging hours on a solicitation immediately changes the Workload card.
- Setting a win/loss outcome immediately changes Client Portfolio win rate and cost-to-bid.
- A user with `viewer` role can read all tabs but cannot log time or set outcomes.
- A "Client Portfolio" report can be generated and appears in Deliverables.
