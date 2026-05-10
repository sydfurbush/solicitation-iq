## Goal

Let the user re-pull SAM.gov attachments from the solicitation page itself — for retrying after failures or grabbing files that were added to the notice later.

## Plan

1. **New "Pull from SAM.gov" button** in the Documents tab header (`src/pages/SolicitationDocuments.tsx`), placed next to the existing "Upload documents" button. It is only enabled when the solicitation has a `sam_url`.

2. **New shared hook** `useSamPullAttachments(solicitationId, samUrl)` in `src/features/solicitations/hooks/useSamPullAttachments.ts`:
   - Calls the existing `sam-import` edge function to refresh the notice and get the current `attachments[]`.
   - Filters out any whose filename already exists on the solicitation (case-insensitive match against `documents.file_name`) so we don't create duplicates.
   - Calls `sam-import-attachments` with the remaining list.
   - Returns counts: `{ found, alreadyImported, imported, failed[] }`.
   - Invalidates the documents query on completion.

3. **Click behaviour & feedback**
   - Toast 1 (info): "Checking SAM.gov for attachments…"
   - Toast 2 (success/warning): "Imported X new attachment(s). Y already on file. Z failed — <first error>." with destructive variant when nothing imported and there were failures.
   - If `found === alreadyImported`, toast: "Already up to date — N attachments on file."

4. **Empty-state CTA** — in `DocumentsEmptyState.tsx`, show a secondary "Pull from SAM.gov" button alongside the uploader when `sam_url` is set, so users can populate documents in one click on a fresh solicitation.

5. **Per-document refresh** is intentionally out of scope for this pass: SAM.gov resource links aren't currently persisted on each `documents` row, so re-pulling a single document would require a schema change. The bulk "Pull from SAM.gov" button covers retry, refresh after a failure, and picking up new amendments. If the user wants per-row refresh later, we'll add `source_url` to `documents` and a row-level action.

## Technical details

- Files to add: `src/features/solicitations/hooks/useSamPullAttachments.ts`.
- Files to edit: `src/pages/SolicitationDocuments.tsx` (header button + pass `sam_url` from the solicitation), `src/features/documents/components/DocumentsEmptyState.tsx` (optional secondary CTA), `src/features/solicitations/hooks/useSolicitations.ts` is already used to fetch the solicitation (no change needed if `sam_url` is in the row).
- No edge function or DB changes — reuses `sam-import` and `sam-import-attachments`.

Proceed?
