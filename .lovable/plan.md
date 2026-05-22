## Goal

Run the full Gemini Pro analysis on the entire solicitation payload without hitting the 150s edge-function idle timeout — and revert the prompt trimming + Flash fallback I just added.

## Approach: background job pattern

Instead of the client `await`-ing the AI call inside `analyze-solicitation`, the function will enqueue a job and return immediately (`202 Accepted`). A worker invocation does the heavy AI call in the background using `EdgeRuntime.waitUntil`, and the UI polls a job row for status.

### 1. Database

New migration creating:

- `analysis_jobs` table
  - `id uuid pk`
  - `solicitation_id uuid` (FK)
  - `analysis_type text` ('full' | 'incremental')
  - `status text` ('queued' | 'running' | 'completed' | 'failed')
  - `progress_step text` (e.g. 'loading docs', 'calling model', 'persisting')
  - `error_message text`
  - `started_at`, `completed_at`, `created_at`, `updated_at timestamptz`
  - `requested_by uuid`
- RLS: org staff and solicitation members can read/insert jobs for solicitations they belong to (reuse `is_solicitation_member`).
- Add `analysis_jobs` to `supabase_realtime` publication so the UI gets push updates instead of polling.

### 2. Edge function refactor (`supabase/functions/analyze-solicitation/index.ts`)

- HTTP handler becomes a thin shell:
  1. Auth + validate `solicitationId`.
  2. Insert a row in `analysis_jobs` with `status='queued'`.
  3. `EdgeRuntime.waitUntil(runAnalysis(jobId))` to perform the work in the background.
  4. Return `202 { jobId }` immediately.
- `runAnalysis(jobId)` contains today's logic (load docs, build prompt, call `callAiTool`, persist results), updating `analysis_jobs.status` / `progress_step` as it goes and writing `error_message` on failure.
- **Revert the workaround:**
  - Remove the per-doc 80k-char budget and the 1500-char per-section cap → restore the original 40 sections × 4000-char excerpts.
  - Remove the `modelOverride` for Flash → use the configured Gemini Pro (`google/gemini-2.5-pro`, `max_tokens=16384`) via MODEL_CONFIG / DB override.
- Background workers in Supabase Edge Functions can run well past 150s, so Pro on the full payload will complete without the 504.

### 3. Frontend rewiring (`src/features/analysis/hooks/useAnalysis.ts` + analysis page)

- `useRunAnalysis` now:
  - Calls the function → receives `{ jobId }`.
  - Stores `jobId` in React Query cache; does NOT await analysis completion.
- New `useAnalysisJob(jobId)` hook:
  - Subscribes to realtime updates on `analysis_jobs` for that id (fallback: 3s polling).
  - Returns `{ status, progressStep, errorMessage }`.
  - On `completed`, invalidates `solicitation-insights` and `solicitation` queries so the new analysis renders.
- Update the analysis page UI to show progress states ("Queued → Loading docs → Running Gemini Pro → Saving") and an error banner on failure.

### 4. Cleanup

- Drop `useAnalysisStatus`'s reliance on `solicitations.status` polling for the run lifecycle (keep it only for the persistent "phase_1_complete" indicator).
- Add a tiny "Cancel run" affordance is **out of scope** for this plan.

## Technical notes

- `EdgeRuntime.waitUntil` is the same primitive already used elsewhere in the project (e.g. `process-document` previously), so no new infra.
- Job rows give us a durable audit trail and let the user navigate away / refresh without losing track of an in-flight analysis.
- This is the same pattern recommended for any other AI function that risks the 150s ceiling (handy to reuse later for `generate-outline`, `generate-report`, etc., though those are not in scope here).

## Files touched

- New: `supabase/migrations/<timestamp>_analysis_jobs.sql`
- Edit: `supabase/functions/analyze-solicitation/index.ts`
- Edit: `src/features/analysis/hooks/useAnalysis.ts`
- Edit: analysis page component that consumes `useRunAnalysis` (the page showing the "Analyze" button + results) to render job progress.