## Goal

Give users visibility into past question-generation runs for a solicitation: status, batch counts, inserted question counts, error message, timing, and which docs failed — so they can audit failures, track retry chains, and decide whether to re-run.

## Where it lives

Runs are scoped to a single solicitation, so the history belongs **inside the Questions tab** rather than a top-level page. We'll add a "History" button next to "Generate" on `SolicitationQuestions` that opens a side **Sheet** with the run list. This avoids a route change and keeps the user in context.

```text
[ Generate ]  [ Add question ]  [ Export ]  [ History ]
                                              ^ new
```

Clicking "History" → right-side `Sheet` titled "Question generation runs".

## What each row shows

For every row in `question_generation_runs` for this solicitation (newest first):

- Status badge: `running` (blue/pulse), `completed` (green), `partial` (amber), `failed` (red).
- Started — relative time (e.g. "3 hours ago"), full timestamp on hover.
- Duration — `completed_at − started_at`, or "running…" if no completion time.
- Counts — `completed_batches / total_batches` · `failed_batches` failed · `inserted_count` questions added.
- Error message — shown inline (muted, italic) when present.
- Failed docs — chip list of file names resolved from `failed_doc_ids` (looked up against the solicitation's `documents`); "+ cross-doc" chip when `cross_doc_failed = true`.
- Retry lineage — small "↳ retry of <relative time>" tag when `parent_run_id` is set.
- Per-row action buttons (right side):
  - **Retry failed batches** — only visible when status is `partial`/`failed` AND there's something to retry. Reuses the existing `useGenerateQuestions({ retryRunId })` flow. Disabled while another run is in-flight.
  - **Copy error** — when `error_message` is present, copies it to the clipboard for support escalation.

## Components & files

### New
- `src/features/questions/hooks/useQuestionGenerationRuns.ts`
  - `useQuestionGenerationRuns(solicitationId)` — TanStack query selecting all columns from `question_generation_runs` for this solicitation, ordered by `started_at desc`. Auto-refetches every 5 s while any row is `running`.
- `src/features/questions/components/QuestionRunsHistorySheet.tsx`
  - Accepts `{ solicitationId, documents, open, onOpenChange }`.
  - Renders the rows described above. Uses `Sheet` from `src/components/ui/sheet.tsx`.
  - Reuses `useGenerateQuestions(solicitationId)` to power the per-row "Retry failed batches" button (with the same toast/progress pattern used in `GenerateQuestionsDialog`).
  - Shows a small inline progress strip at the top while a retry initiated from this sheet is in flight ("Batch X of Y · Z added").

### Updated
- `src/pages/SolicitationQuestions.tsx`
  - Add `historyOpen` state and a new toolbar button: `<Button variant="outline" size="sm" onClick={() => setHistoryOpen(true)}><History className="mr-1 h-4 w-4" /> History</Button>` (lucide `History` icon).
  - Mount `<QuestionRunsHistorySheet ... />` alongside the other dialogs.

### Not changed
- No DB migration — the `question_generation_runs` table already has every field needed (`status`, `total_batches`, `completed_batches`, `failed_batches`, `inserted_count`, `current_step`, `error_message`, `failed_doc_ids`, `cross_doc_failed`, `parent_run_id`, `started_at`, `completed_at`).
- No edge function changes.
- No new RLS — existing `staff view qgen runs` policy already covers reads for org staff.

## Empty / loading states

- Loading: 3 row skeletons inside the sheet.
- Empty: centered message "No generation runs yet. Click Generate to create the first one."
- Long lists: cap at the 50 most recent runs; if there are more, show a small "Showing latest 50" footer note.

## Edge cases

- Stale `running` rows (function crashed before final write): show with status `running` but display "started X hours ago" so users can spot zombies; no special handling beyond surfacing it.
- Documents that have been deleted since a run: `failed_doc_ids` IDs that don't resolve render as `Unknown document` chips rather than disappearing.
- Retry from a row whose parent has already been resolved: still allowed; the function-side validation (already added previously) will reject if `failed_doc_ids` is empty AND `cross_doc_failed` is false.

## Out of scope

- No CSV/JSON export of run history.
- No filter/search inside the sheet (50-row cap keeps it short).
- No top-level "/runs" route or org-wide cross-solicitation view.
- No realtime postgres subscription — 5 s polling while any row is `running` is sufficient.

## Expected outcome

Users can open a side panel from the Questions tab, see a chronologically ordered audit trail of every generation attempt with what failed and why, and one-click retry any partial/failed run without leaving the tab.