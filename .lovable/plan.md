## Diagnosis

The `sam-import-attachments` function executed successfully (HTTP 200 in 2.9s) but every one of the 11 SAM.gov downloads failed inside the worker loop. Two issues in the current code explain it:

1. **API key not appended to download URLs.** SAM.gov `resourceLinks` look like `https://sam.gov/api/prod/opps/v3/opportunities/resources/files/<id>/download?token=...` (or `api.sam.gov/...`). They require `?api_key=...` to return the actual file. My code only appends the key when `hostname.includes("api.sam.gov")` — most resource links use `sam.gov`, so the request returned an HTML error / 401 page.
2. **Silent per-file failure.** The function never logs per-attachment errors, so the only signal was the toast count. We can't see *why* each one failed.

A secondary issue: even when the download succeeds, SAM sometimes returns a filename only in `Content-Disposition` with no extension in the URL path; if `Content-Disposition` is missing, we fall back to the URL's last path segment (e.g. `download`) which has no extension and gets rejected.

## Fix

Edit `supabase/functions/sam-import-attachments/index.ts`:

1. **Always append `api_key`** when the host is any `*.sam.gov` (not just `api.sam.gov`) and the URL doesn't already have `api_key`.
2. **Treat non-2xx as a hard failure with the response body** (first 200 chars) included in the per-file `error`, so we can see what SAM returned.
3. **Better filename/extension fallback:**
   - Parse `Content-Disposition` (already done) but also handle `filename*=UTF-8''…` form properly.
   - If still no extension, derive one from `Content-Type` (already done) and synthesize `attachment-<shortId>.<ext>`.
   - If `Content-Type` is `text/html` or `application/json`, treat as failure (likely an error page) and surface the body snippet.
4. **Console-log every attempt** (`console.log("sam-attachment", { href, status, contentType, fileName, ext })`) and every failure, so the next attempt is debuggable from edge logs.
5. **Return `failed[]` items with `href` + `error` + `status`** so the client toast/UI can show specifics.

No client/UI changes needed for the fix itself, but I'll also tweak the `CreateSolicitationDialog` toast on failure to include the first failed reason (e.g. "1 of 11 imported — `Download failed (401): {...}`") so the user gets actionable feedback without opening logs.

## Technical details

- Files to edit: `supabase/functions/sam-import-attachments/index.ts`, `src/features/solicitations/components/CreateSolicitationDialog.tsx` (toast copy only).
- No DB or schema changes.
- After deploy, retry the same SAM.gov URL — edge function logs will show per-file results, and the import should succeed for all 11 attachments.

Proceed?
