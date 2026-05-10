## Problem

After "Prefill" from a SAM.gov URL, the form fields populate but no documents appear on the new solicitation. The current edge function returns an `attachments` array (`resourceLinks` from SAM.gov), but nothing downloads or uploads them — the dialog only shows a hint message ("Upload them in the Documents tab after creating the solicitation").

## Goal

When a SAM.gov URL is imported, automatically pull every attachment SAM.gov lists for that notice and add them as documents on the solicitation, ready for the existing parsing/analysis pipeline.

## Plan

1. **New edge function `sam-import-attachments`**
   - Input: `{ solicitationId, attachments: [{ href, fileName? }] }`.
   - Validates the user can write to the solicitation (uses caller's JWT against RLS via the user-scoped Supabase client).
   - For each `href`:
     - `fetch(href)` (SAM.gov resource links are public; if a key is needed, append `?api_key=…` from `SAM_GOV_API_KEY`).
     - Follow redirects, read `Content-Disposition` / `Content-Type` to derive filename + extension; fall back to a hash of the URL.
     - Skip unsupported extensions (reuse the allow-list from `fileHelpers.ts`).
     - Upload bytes to the `solicitation-documents` bucket at `{org_id}/{client_id}/{solicitation_id}/{uuid}.{ext}` using the **service-role** client (so storage RLS is bypassed safely after auth check).
     - Insert a row in `documents` with `status='uploading'`, correct `file_name/path/size/type/document_type='other'`.
     - Invoke `process-document` for that document id (fire-and-forget) so it gets parsed.
   - Returns `{ imported: n, skipped: [...], failed: [...] }`.

2. **Wire it into the create flow** (`CreateSolicitationDialog.tsx`)
   - After `createMut.mutateAsync(values)` succeeds and `attachments.length > 0`, call the new function with `created.id` and the stored `attachments`.
   - Show a toast: "Importing N attachment(s) from SAM.gov…" then a completion toast with counts.
   - Replace the current "Upload them in the Documents tab" hint with "These N attachments will be added automatically when you create the solicitation."

3. **Edge function for the importer URL parsing**
   - Keep `sam-import` as-is for prefill; only the new function handles file downloads. This keeps prefill fast and lets attachment import run in the background.

4. **Quiet runtime fix**
   - Address the `Cannot read properties of undefined (reading 'toLowerCase')` error surfacing on this page (likely from the SAM prefill setting an undefined `agency_type`/`set_aside` that a Select reads). Guard the lookup in `SolicitationForm` so missing strings don't crash.

## Technical details

- Files to add: `supabase/functions/sam-import-attachments/index.ts`.
- Files to edit: `src/features/solicitations/components/CreateSolicitationDialog.tsx` (post-create hook + copy), `src/features/solicitations/components/SolicitationForm.tsx` (defensive guard for the toLowerCase crash).
- Reuses existing buckets, `documents` table, RLS, and `process-document` function — no migration needed.
- Concurrency cap of 3 downloads inside the function to stay under the edge function timeout for typical SAM notices (≤10 attachments).

Want me to proceed with this?
