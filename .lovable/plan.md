# Notify when all documents are Analyzed and ready for questions

## Goal

Surface a clear, automatic notification on the solicitation page the moment **every** non-deleted document for that solicitation reaches `status = 'analyzed'`, so the user knows it's safe to move on to **Generate strategic questions**.

## Behavior

- While any document is still `uploading`, `parsed`, `processing`, or `failed`, show a small "readiness" indicator in the Documents/Phase 1 header:
  - `"3 of 4 documents analyzed — 1 still processing"` (or `"1 failed"` in destructive color when applicable).
- The instant the last document flips to `analyzed`, fire a one-time toast:
  - Title: **"All documents ready"**
  - Description: **"4 of 4 analyzed. You can now generate strategic questions."**
  - Action button: **"Generate questions"** → navigates to `?tab=phase-1&step=questions` and opens the Generate dialog.
- The toast fires only on the *transition* from "not all analyzed" → "all analyzed", not on every refresh, and not when the page first loads already-complete (in that case just show the steady-state badge "All documents analyzed ✓").
- If any document is `failed`, do NOT fire the success toast; instead keep the readiness badge in destructive style with the count of failures.

## Realtime trigger

Use Supabase Realtime on the `documents` table filtered by `solicitation_id` so the toast appears without the user manually refreshing. Realtime is already used elsewhere in the app (`useClientNotifications`), so the pattern is established.

```text
documents (UPDATE) ── filter: solicitation_id=eq.<id>
   └── invalidate ["documents", solicitationId]
        └── readiness hook recomputes → transition detector → toast
```

## Implementation

### New hook
`src/features/documents/hooks/useDocumentsReadiness.ts`
- Input: `solicitationId`.
- Reads from the existing `useDocuments(solicitationId)` query (no extra fetch).
- Computes `{ total, analyzed, failed, processing, allReady, hasFailures }`.
- Subscribes to Postgres changes on `documents` for that solicitation and invalidates the documents query so counts stay live.
- Tracks the previous `allReady` value in a ref; when it transitions `false → true` and `hasFailures === false`, emits a one-shot callback (or returns a `justBecameReady` boolean for the consumer to react to).

### Mount the watcher at the solicitation level
`src/pages/SolicitationDetail.tsx` (or whichever component wraps all phase tabs — confirm during implementation):
- Call `useDocumentsReadiness(solicitationId)` once so the toast fires regardless of which tab the user is on.
- On `justBecameReady`, call `toast({ title: "All documents ready", description: "...", action: <ToastAction>Generate questions</ToastAction> })`. Action navigates to the questions step and sets a query param like `&autoOpenGenerate=1`.

### Header badge
`src/pages/SolicitationDocuments.tsx` — replace the existing `"X of Y documents analyzed"` line with a richer `<DocumentReadinessBadge />` (new small component in `src/features/documents/components/`) that shows:
- `Loader2` + `"3 of 4 analyzing…"` while in progress
- `AlertTriangle` + `"1 failed"` (destructive) when failures exist
- `CheckCircle2` + `"All 4 analyzed"` (success) when complete

### Auto-open Generate dialog
`src/pages/SolicitationQuestions.tsx`:
- Read the `autoOpenGenerate` query param on mount and call `setGenerateOpen(true)` once, then strip the param.

## Out of scope

- No DB schema changes, no edge-function changes.
- No persistent notification record — this is an in-session toast plus a live header badge. (We can layer on `client_notifications` later if you want a bell-icon history.)
- Does not change the existing retry/failed-document flow.

## Verification

1. With the current 4 docs (3 analyzed, 1 failed), the header badge shows **"1 failed"** in red and no success toast appears.
2. Retry the failed doc; when it flips to `analyzed`, the toast **"All documents ready"** appears with a **Generate questions** button, and the badge turns green **"All 4 analyzed"**.
3. Reload the page after everything is analyzed — no toast re-fires; the green badge is shown immediately.
4. Click the toast's **Generate questions** action — lands on `?step=questions` with the Generate dialog open.
