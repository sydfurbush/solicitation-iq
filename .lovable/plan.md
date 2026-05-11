## Problem

The history sheet shows a partial run with `1 batch(es) failed`, but no **Retry failed** button appears.

I checked the actual run record in the database:

```
status: partial
failed_batches: 1
failed_doc_ids: []         ← empty
cross_doc_failed: false    ← false
```

The Retry button is gated on `failed_doc_ids.length > 0 || cross_doc_failed` in both `QuestionRunsHistorySheet.tsx` and `GenerateQuestionsDialog.tsx`. When a batch fails but neither marker was recorded (older edge-function version, or an unusual failure path), retry becomes impossible even though work is clearly missing.

The edge function also rejects retries with HTTP 400 when both markers are empty, so even forcing the button to show wouldn't currently work.

## Fix

Treat `failed_batches > 0` as the source of truth for "needs retry" and have the retry path gracefully handle the "we don't know which docs failed" case by re-running everything in append-only mode.

### 1. UI — show Retry whenever the run failed

In `QuestionRunsHistorySheet.tsx` and `GenerateQuestionsDialog.tsx`, change the gate from:

```ts
(status === "partial" || status === "failed") && (failed_doc_ids.length > 0 || cross_doc_failed)
```

to:

```ts
(status === "partial" || status === "failed") &&
(failed_batches > 0 || failed_doc_ids.length > 0 || cross_doc_failed)
```

When `failed_doc_ids` is empty and `cross_doc_failed` is false, label the button **Retry run** (instead of "Retry failed batches") and show a small subtext: *"Original failure scope unknown — will re-run all documents and append new questions."* This sets expectations.

### 2. Edge function — accept "unknown scope" retries

In `supabase/functions/generate-questions/index.ts`:

- Also load `failed_batches` from the prior run.
- Replace the "no failed batches to retry" 400 with: if `failed_doc_ids` is empty and `cross_doc_failed` is false **but** `failed_batches > 0`, fall back to a full retry — process all eligible documents and run the cross-doc pass, still in append-only mode (`didRegenDelete = true`, never deletes existing AI questions).
- Keep the original 400 only when `failed_batches === 0` (truly nothing to retry).

### 3. Plug the data gap going forward

In the per-batch loop, ensure `failed_doc_ids` is always written when a batch fails — already correct in current code (`for (const d of batch) failedDocIds.push(d.id)` in both the insert-error branch and the catch). No code change here, but add one defensive log when `failed > 0` and `failedDocIds.length === 0 && !crossDocFailed` so future occurrences are diagnosable.

## Out of scope

- No DB migration.
- No changes to batching logic, prompts, or question schema.
- No backfill of the existing run's `failed_doc_ids` (impossible — the info wasn't recorded).