# Preserve Comparison History on Re-Run

## Problem
Re-running the comparison overwrites `prior_solicitations.comparison_summary` and `changes_identified` in place, destroying the previous run. The user just lost their earlier report this way.

## Goal
1. Recover what we can of the lost run (best-effort — likely not possible without a backup; data was overwritten in place).
2. Going forward, every run is archived so old reports remain accessible.

## Recovery of the lost run
The overwritten columns have no audit trail today, so the previous JSON is gone unless we have a Postgres point-in-time backup. We will check Lovable Cloud for a restore point; if none exists, the prior data cannot be recovered. We'll be upfront about that with the user before doing anything else.

## Going forward — versioned comparison runs

### New table: `comparison_runs`
Append-only history, one row per run.

```text
comparison_runs
├── id                       uuid pk
├── prior_solicitation_id    uuid  -> prior_solicitations.id (the link)
├── solicitation_id          uuid  (current sol — for RLS via is_solicitation_member)
├── run_number               int   (1,2,3… per prior_solicitation_id)
├── summary                  text
├── changes_identified       jsonb
├── label                    text  (optional user note, e.g. "after Amendment 3")
├── created_by               uuid
└── created_at               timestamptz default now()
```
RLS mirrors `prior_solicitations` (members of the solicitation can read; staff can write). Edge function uses service role so writes are unrestricted.

### Edge function change (`compare-solicitations`)
Instead of `UPDATE prior_solicitations`, **INSERT** a new `comparison_runs` row with the next `run_number`, then update `prior_solicitations` to point at the latest run (keeps existing UI working unchanged):
- `comparison_summary` = latest summary
- `changes_identified` = latest changes
- `comparison_completed_at` = now

This way `prior_solicitations` always reflects the most recent run (no UI break), and full history lives in `comparison_runs`.

### UI additions (Comparison tab)
- **History dropdown** next to the "Re-run comparison" button listing prior runs by date + label. Selecting one renders that run's `summary`/`changes_identified` read-only in the existing comparison panels.
- **Label this run** small input shown after a run completes, writes to `comparison_runs.label`.
- Confirm dialog on **Re-run** that explicitly says "Your current report will be archived and a new one generated."

### Files touched
- `supabase/migrations/<new>.sql` — create `comparison_runs` + RLS + backfill one row from existing `prior_solicitations` so today's data becomes run #1.
- `supabase/functions/compare-solicitations/index.ts` — insert into `comparison_runs`, then update `prior_solicitations`.
- `src/features/comparison/hooks/useComparisonRuns.ts` — new hook listing runs + fetching a specific run.
- `src/features/comparison/components/ComparisonHistoryPicker.tsx` — dropdown.
- `src/pages/SolicitationComparison.tsx` — wire picker; when a historical run is selected, pass its `changes`/`summary` to the existing child components instead of the latest.
- `src/features/comparison/hooks/useRunComparison.ts` — add confirm-before-rerun affordance (UI side), no API change.

## Open question for the user
Do you want me to also try to recover the lost run via a Cloud point-in-time restore (only possible if a backup snapshot exists from before the re-run), or only set up the history going forward?
