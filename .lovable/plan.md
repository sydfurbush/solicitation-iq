## Root cause

The `solicitation-documents` storage bucket has an `allowed_mime_types` restriction that does not include `application/octet-stream`. SAM.gov serves attachment downloads with `Content-Type: application/octet-stream` regardless of the actual file format. The current `sam-import-attachments` code passes that raw content type into `admin.storage.upload(..., { contentType })`, so storage rejects every upload with:

```
mime type application/octet-stream is not supported
```

The download itself works (we already log `status: 200, ext: "pdf"`); the failure is at the storage upload step. Manual uploads work because the browser sends `application/pdf`.

## Fix

In `supabase/functions/sam-import-attachments/index.ts`, derive a proper MIME type from the resolved file extension and use that for both the storage upload and the `documents.file_type` column. Only fall back to the response's content-type when the extension is unknown (which can't happen here because we already reject unknown extensions just above).

Add a small `mimeFromExt(ext)` map covering the existing `ALLOWED_EXT` list:

```text
pdf  -> application/pdf
doc  -> application/msword
docx -> application/vnd.openxmlformats-officedocument.wordprocessingml.document
xls  -> application/vnd.ms-excel
xlsx -> application/vnd.openxmlformats-officedocument.spreadsheetml.sheet
ppt  -> application/vnd.ms-powerpoint
pptx -> application/vnd.openxmlformats-officedocument.presentationml.presentation
txt  -> text/plain
csv  -> text/csv
```

Then change:

- `upload(path, buf, { ..., contentType })` → use `uploadContentType = mimeFromExt(ext) ?? contentType`
- `documents.file_type: contentType` → use the same `uploadContentType`

No DB changes, no bucket changes, no other functions touched. This is a single-file edit and matches the user's request to keep the work scoped to the failing import path.

## Verification

After the change, re-run "Pull from SAM.gov" on the current solicitation (the 11-attachment notice in the logs). Expected: all 11 succeed, with `file_type = application/pdf` on the new `documents` rows. Check edge function logs for absence of "mime type ... is not supported".
