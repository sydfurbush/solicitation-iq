## Goal

Add a "Retry failed batches" button that re-runs only the document batches (and/or the cross-document pass) that failed in the most recent generation run, instead of re-processing the entire solicitation package.

## How it works today

- `generate-questions` packs documents into N per-doc batches plus 1 cross-doc pass, runs them sequentially, and writes counts (`completed_batches`, `failed_batches`, `inserted_count`) to `question_generation_runs`.
- The run record knows *how many* batches failed but not *which* docs were in those failed batches, so the UI can only offer a full re-run.

## What we'll change

### 1. Database — track failure detail per run

Add two columns to `question_generation_runs`:

- `failed_doc_ids uuid[] not null default '{}'` — flat list of document IDs whose batch failed (a batch contains 1–3 docs; if it fails, all its doc IDs go in here).
- `cross_doc_failed boolean not null default false` — true if the cross-document contradiction pass failed.

No RLS changes needed (existing policies cover the table).

### 2. Edge function `generate-questions`

- **Track per-batch identity.** When a batch throws/insert-errors, append `batch.map(d => d.id)` to a `failedDocIds` accumulator and update the run row with `failed_doc_ids`. Set `cross_doc_failed = true` if the cross-doc pass fails.
- **New retry mode.** Accept a new optional input shape:
  ```ts
  { solicitationId, retryRunId: string }
  ```
  When `retryRunId` is provided:
  - Load the prior run; require `status in ('partial','failed')` and same `solicitation_id`.
  - Restrict `documents` to `prior.failed_doc_ids` (skip per-doc batches entirely if empty).
  - Run the cross-doc pass only if `prior.cross_doc_failed` was true.
  - **Never delete existing rows** in retry mode (ignore `regenerate`); always append.
  - Create a new `question_generation_runs` row that links to the prior one via a new `parent_run_id uuid` column (added in migration above) so we keep history.
  - On success/partial, also clear the parent's `failed_doc_ids` entries that succeeded this round, and update the parent's `status` to `completed` if everything is now resolved.
- Non-retry path is unchanged except for populating `failed_doc_ids` / `cross_doc_failed`.

### 3. Hook `useStrategicQuestions.ts`

- Extend `useGenerateQuestions` input to accept `retryRunId?: string` and forward it to the function. Polling logic is identical (it polls the new run id returned from the function).
- Add a small `useLatestQuestionRun(solicitationId)` query that selects the most recent row from `question_generation_runs` for that solicitation (status, failed_batches, failed_doc_ids, cross_doc_failed, completed_at). Used by the dialog to decide whether to show the retry button.

### 4. UI `GenerateQuestionsDialog.tsx`

- When the dialog opens, read the latest run via the new hook.
- If `latestRun.status` is `partial` or `failed` AND (`failed_doc_ids.length > 0` OR `cross_doc_failed`), show a new section above the "Generate" button:
  ```
  Last run finished with N failed batch(es).
  [ Retry failed batches ]   <- secondary button
  ```
  with a one-line description listing the affected file names (looked up from the `documents` prop) and "+ cross-document pass" if applicable.
- Clicking the button calls `generate.mutateAsync({ retryRunId: latestRun.id, onProgress: setProgress })`. Same progress UI is reused. Toast wording on success: "Retried N batch(es) · X questions added".
- The existing "Generate" / "Replace existing" controls stay unchanged for full re-runs.

### 5. Out of scope

- No changes to question schema, categorization, prompts, or the cross-doc logic itself.
- No retry-individual-batch UI; retry is always "all currently-failed batches from the last run".
- No automatic retry on dialog open — user must click the button.

## Technical notes

- Migration is additive (`add column ... default ...`), safe on existing rows.
- The retry endpoint is the same edge function; only the request body shape distinguishes the modes, so no new function deployment plumbing is needed.
- Because retries create a fresh run row, the existing polling code in `useGenerateQuestions` works unchanged.
- If the retry itself fails again, the new run row will carry its own `failed_doc_ids`, so the user can keep retrying.

## Expected outcome

After a partial run, the user sees exactly which files failed and can recover them with one click in seconds, without re-billing or re-processing the docs that already succeeded.