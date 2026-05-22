# Fix: Documents stuck at "processing"

## What's actually happening

The badge says "11 of 13 analyzed · 2 processing", but in the database those 2 documents (`Technical Exhibit F IIC Information.pptx` and `TAP PWS - Updated 8 MAY 26.pdf`) are at `status = 'parsed'`, not `analyzed`. They finished text extraction successfully — they just never advanced to the final `analyzed` state.

The pipeline is two hops:

```text
process-document  →  status='parsed'  →  (fires extract-entities via EdgeRuntime.waitUntil)  →  status='analyzed'
```

Two problems with hop #2:

1. **The trigger is fire-and-forget inside `waitUntil`.** Edge function logs show **zero invocations** of `extract-entities` for either document. When `process-document` returns immediately after queueing the fetch, the runtime can tear the worker down before the outbound POST is actually sent. There is no DB-level guarantee or retry.
2. **No watchdog.** Once a doc lands in `parsed`, nothing ever re-checks it. The UI's `useDocumentsReadiness` only counts `status='analyzed'` as ready, so any doc that misses the handoff stays "processing" forever.

The earlier work on `extract-requirements`/`generate-outline` raised timeouts and `max_tokens`, but didn't touch this trigger path.

## Plan

### 1. Recover the 2 stuck documents (one-time)
Manually re-invoke `extract-entities` for the two `parsed` documents from the client (existing `useExtractEntities` hook already does this) — or just have the user click a new "Retry analysis" action we'll add in step 3. No migration needed.

### 2. Make the parsed→analyzed handoff reliable
In `supabase/functions/process-document/index.ts`:
- Replace the `EdgeRuntime.waitUntil(fetch(...))` fire-and-forget with an **awaited** invoke of `extract-entities` (it's already retry-safe and idempotent on entities). Adds a few seconds to `process-document` but guarantees the status transition before we return.
- If `extract-entities` errors, leave the doc at `parsed` with `processing_error` set so the watchdog/UI can surface it (don't flip to `failed` just because entity extraction hiccupped — text is already parsed and usable).

### 3. UI watchdog + manual retry
In `src/features/documents/`:
- **`useDocumentsReadiness.ts`**: detect docs that have been `parsed` (not `analyzed`) for > 2 minutes and surface them as `stalled` in the returned shape.
- **`DocumentReadinessBadge.tsx`**: when `stalled > 0`, render an amber state ("11 of 13 analyzed · 2 stalled — Retry") with a button that calls `useExtractEntities` for each stalled doc.
- **`ProcessingStatus.tsx`** / row-level menu: add a "Retry analysis" action for any row stuck on `parsed`, also wired to `useExtractEntities`.

### 4. Server-side safety net (optional, small)
At the top of `extract-entities`, if `doc.status === 'analyzed'` already, return `{ok:true, skipped:true}` — makes the retry button safe to mash. (The function already replaces entities idempotently, so this is just a fast-path.)

## Out of scope
- No new tables, no job queue, no cron. The await + UI watchdog is enough for this pipeline's volume.
- No changes to `extract-requirements`, `generate-outline`, or AI model settings.
- No change to readiness math beyond adding the `stalled` bucket.

## Files touched
- `supabase/functions/process-document/index.ts` — await extract-entities, soften error handling
- `supabase/functions/extract-entities/index.ts` — early-return if already analyzed
- `src/features/documents/hooks/useDocumentsReadiness.ts` — add `stalled` count
- `src/features/documents/components/DocumentReadinessBadge.tsx` — stalled state + retry
- `src/features/documents/components/ProcessingStatus.tsx` (or `DocumentList` row menu) — per-row "Retry analysis"
