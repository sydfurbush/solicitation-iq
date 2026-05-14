## Goal

Allow users to upload PDF, Word (.doc/.docx), and Excel (.xls/.xlsx) files — in addition to the current .txt/.md — into the Client Knowledge Library on the Clients → Knowledge tab.

## Changes

### 1. Frontend — `src/features/clients/components/KnowledgeTab.tsx`
- Expand the file input `accept` attribute to include `.pdf, .doc, .docx, .xls, .xlsx` along with their MIME types.
- Update the button label from "Upload .txt/.md" to "Upload file".
- Update the empty-state copy to reflect the new supported types ("Upload PDF, Word, Excel, .txt, or .md").

### 2. Frontend hook — `src/features/clients/hooks/useClientKnowledge.ts` (`useUploadKnowledgeFile`)
- Replace the `.txt`/`.md`-only guard with a list of allowed extensions: `.pdf, .doc, .docx, .xls, .xlsx, .txt, .md`.
- Add a 25 MB size guard with a clear error message.
- Keep the existing storage upload + insert + invoke flow unchanged.

### 3. Edge function — `supabase/functions/ingest-client-knowledge/index.ts`
- Replace `readUploadedText` with a multi-format extractor that mirrors the proven approach already used in `supabase/functions/process-document/index.ts`:
  - `pdf-parse` for `.pdf`
  - `mammoth` for `.doc`/`.docx`
  - `xlsx` (SheetJS) → CSV-per-sheet for `.xls`/`.xlsx`
  - existing text path for `.txt`/`.md`
- Return a clear error if extraction yields empty text (e.g., scanned PDF). The document row's `status` is already set to `failed` with the error message by the existing catch block, which the UI surfaces.

## Out of scope
- OCR for scanned PDFs.
- Changes to chunking, embeddings, or retrieval logic.
- Changes to the "note" path or any other tab.

## Verification
- Upload a small PDF, .docx, and .xlsx on the Knowledge tab; confirm each transitions pending → embedding → ready with a non-zero chunk count.
- Confirm an unsupported file (e.g., `.zip`) is rejected client-side.
- Confirm a scanned/empty PDF surfaces a readable failure message on the row.
