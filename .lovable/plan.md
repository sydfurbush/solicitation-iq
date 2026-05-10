## Root cause

All 11 documents are actually in `failed` status in the database with the same error: **`Buffer is not defined`**. The mixed badges in the UI ("Uploading", "Analyzing…", "Failed") are stale/cached states from before the rows hit the failed terminal state — the underlying problem is one bug in the `process-document` edge function.

`supabase/functions/process-document/index.ts` calls `Buffer.from(fileBytes)` (lines 37, 40, 48) but never imports `Buffer`. Deno's edge runtime does not expose `Buffer` as a global, so every PDF/DOCX extraction crashes immediately.

## Fix

**1. Import `Buffer` in `process-document/index.ts`**

Add at the top of the file:
```ts
import { Buffer } from "node:buffer";
```
That's the only code change needed — the rest of the extraction logic is correct (`pdf-parse` and `mammoth` both expect a Node `Buffer`, which `node:buffer` provides under Deno).

**2. Re-process the 11 failed documents**

After the function redeploys, reset and re-trigger them with a one-shot SQL + invocation. Two options:

- **Option A (recommended):** Run a SQL update to flip them back to `uploading`, then call `process-document` for each id from the UI's existing "Retry" button on each failed card. The user already has that button.
- **Option B:** Add a small "Retry all failed" button to the Documents toolbar that loops through `docs.filter(d => d.status === 'failed')` and calls `invokeProcessDocument` for each (mirrors the existing `onBulkReprocess` pattern, just pre-filtered to failed). This is a convenience addition — not required for the fix.

## Suggested approach

Do step 1 only first (single-line import change + redeploy), then click "Retry" on the failed cards (or use the existing bulk select → reprocess) to push them through. If you'd like, I can also add the "Retry all failed" button in the same change.

## Files touched

- `supabase/functions/process-document/index.ts` — add `import { Buffer } from "node:buffer";`
- *(optional)* `src/pages/SolicitationDocuments.tsx` — add "Retry all failed" button
