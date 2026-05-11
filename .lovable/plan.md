## Goal

When SAM.gov lookup fails or the user already has the prior solicitation as a PDF, let them upload one or more documents and use those as the prior solicitation for comparison — no SAM.gov call needed.

## UX

In `LinkPriorSolicitationDialog`, add a third tab alongside "From this client" and "External reference":

- **Upload documents** (new tab)
  - Title input (required, e.g. "FY24 RFP – W912DY-19-R-0001")
  - Optional reference / solicitation number
  - Optional notes
  - Drag-and-drop file area (reuses `DocumentUploader` patterns / `react-dropzone`, accepts PDF/DOCX, multi-file, 50MB each)
  - Primary button: "Upload & compare" (disabled until title + at least one file)

Progress is shown via the existing `ImportProgressPanel` with stages: `creating → uploading → parsing → comparing → done`.

## Flow (client-side, no new edge function needed)

1. Create a shadow `solicitations` row (status `archived`, `tags: ["prior","manual-upload"]`, `metadata.imported_from_upload = true`, linked to the current solicitation's `client_id`) — same shape used by the SAM import path.
2. Insert a `prior_solicitations` link row referencing the new shadow id, with `external_reference` / `external_url` set from the form (url left null).
3. For each uploaded file, call the existing `useUploadDocument` mutation against the shadow solicitation (this already triggers `process-document` / parsing).
4. Poll with the existing `waitForDocumentsParsed(shadowId)` helper.
5. Run `useRunComparison` with the new shadow id + link record id.
6. Close dialog and toast "Comparison updated".

Errors at any stage surface in the progress panel; partial uploads can be retried by re-opening the dialog (same shadow can be reused if we keep its id, but v1 just reports the failure).

## Files

- **New** `src/features/comparison/hooks/useUploadPriorDocuments.ts` — orchestrator mutation: creates shadow solicitation + link, uploads files via `useUploadDocument`, returns `{ priorSolicitationId, priorRecordId, uploaded, failed }`.
- **Edit** `src/features/comparison/components/LinkPriorSolicitationDialog.tsx` — add `"upload"` tab, form state for title/ref/notes/files, dropzone UI, wire up new hook + existing `waitForDocumentsParsed` + `useRunComparison`, reuse `ImportProgressPanel`.
- *(Optional follow-up, not in this plan)* extract a small `PriorDocumentDropzone` component if the dialog gets too big.

## Out of scope

- No DB schema changes (existing `prior_solicitations` + `solicitations` + `documents` tables already support this).
- No new edge function.
- No changes to the SAM import path or error handling.
