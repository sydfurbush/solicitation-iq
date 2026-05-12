## Short answer

**Yes — two ways, one already exists, one is half-built.**

### What exists today

- The **"Process all (N)"** button on the Documents tab already targets only docs with status `parsed`, `failed`, or `uploading`. So if every other doc is `analyzed`, clicking it effectively re-runs only the 2 failed ones. It just doesn't *say* that.
- `DocumentCard` already has an `onRetry` handler and renders a **"Retry processing"** menu item in the row's `⋯` menu **when the doc's status is `failed`** — but the parent (`SolicitationDocuments` → `DocumentList`) never wires `onRetry` through, so clicking it does nothing today.

### Proposed plan

1. **Wire the per-row retry** (the main fix).
   - `DocumentList.tsx`: accept and forward an `onRetry` prop to each `DocumentCard`.
   - `SolicitationDocuments.tsx`: pass `onRetry={(d) => { invokeProcessDocument(d.id); toast(...); qc.invalidate(["documents", solicitationId]); }}`.
   - Result: open the `⋯` on a Failed card → **Retry processing** → just that document re-runs.

2. **Add a "Retry failed (N)" button** next to "Process all" when any failed docs exist.
   - Same component (`ProcessAllDocuments.tsx`), second button rendered only when `failed.length > 0`.
   - Reuses the existing concurrency runner, but filters to `status === "failed"` only.
   - Label updates to `Retrying 1 of 2…` while running.

3. **Show the failure reason on hover.**
   - Tooltip on the red **Failed** badge bound to `doc.processing_error` so you can see *why* before clicking retry. Pure read of an existing column, no schema change.

### Out of scope

- No DB changes.
- No edge-function changes (Phase 1 / 2 model swap from the previous plan handles the underlying cause).
- No bulk-action changes elsewhere.

### Verification

- On this solicitation, the two PDFs flip Failed → Analyzed when Retry is clicked individually.
- "Retry failed (2)" runs both with the progress bar and finishes with a toast.