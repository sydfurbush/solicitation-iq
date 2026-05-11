## Problem

When a prior solicitation is already linked as **external reference only** (the user's current state — `W9124D26RA001`), the "Comparison is limited" alert only offers **Import from SAM.gov**. There's no way to feed in a PDF the user already downloaded, so they're stuck when SAM is unreachable / quota-exhausted.

The "Upload documents" tab from the previous change only lives inside the *Link prior solicitation* dialog, which doesn't appear once a link already exists.

## Fix

Add an **Upload documents** action right next to **Import from SAM.gov** inside the "Comparison is limited" alert in `ComparisonOverview`.

### UX

```text
[ Import from SAM.gov ]   [ Upload documents ]   [ Cancel (when running) ]
```

Clicking **Upload documents** opens a small dialog with:
- Title (defaults to current `external_reference`)
- File dropzone (PDF/DOCX/etc., 50MB each, multi-file) — same accepts as `DocumentUploader`
- Primary button **Upload & compare**

Progress shown via the existing `ImportProgressPanel` inline in the alert (same place as the SAM progress).

### Flow

Reuse the existing `useUploadPriorDocuments` hook (already built):
1. Create shadow prior solicitation + new `prior_solicitations` link.
2. Upload files → parse → run `compare-solicitations`.
3. Mirror the SAM path: drop the old external-only link (`unlink.mutate(linkIdAtStart)`) so the new fully-linked record becomes canonical.
4. Log a `prior_import_history` row with `source: "upload"`, `action: "initial"`, status/counts from the result.
5. Refresh `usePriorSolicitation`.

Errors and cancellation use the same `AbortController` + `setProgress({ stage: "error", ... })` pattern already in `handleImportFromSam`.

## Files

- **Edit** `src/features/comparison/components/ComparisonOverview.tsx`
  - Add `useUploadPriorDocuments` import + state for dialog open and selected files.
  - New `handleUploadPrior` mirroring `handleImportFromSam` (same logging, link-swap, progress).
  - New `Upload documents` button inside the `isExternalOnly` alert.
  - New small inline `<UploadPriorDialog>` (or extracted to `./UploadPriorDocumentsDialog.tsx`) reusing the dropzone UI from `LinkPriorSolicitationDialog`.

- **New (optional, recommended)** `src/features/comparison/components/UploadPriorDocumentsDialog.tsx` — extract the dropzone + title/notes form so it can be shared by both the link dialog and the overview alert. The existing `LinkPriorSolicitationDialog`'s `UploadTabContent` is moved here.

- **Edit** `src/features/comparison/components/LinkPriorSolicitationDialog.tsx` — swap inline `UploadTabContent` for the shared component (no behavior change).

- **Edit** `src/features/comparison/hooks/usePriorImportHistory.ts` (only if needed) — confirm `source` accepts `"upload"`; otherwise widen the type. *(I'll verify during implementation; the DB column is plain `text` so no migration needed.)*

## Out of scope

- No DB schema changes.
- No edge function changes.
- No changes to the SAM import path.
- An empty-state "Upload documents" entry already exists via the link dialog tab — not touched.
