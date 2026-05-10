## Goal

Run a structured end-to-end QA pass on the Solicitation Intelligence Analyzer for internal team use, find every blocker / bug / rough edge, and fix them before you start using it for real client work.

## Approach

We'll walk the full happy-path workflow with real data, in the order an analyst would actually use it. At each step we verify: (1) the UI works, (2) the data persists correctly in the database, (3) the AI edge functions return useful output, and (4) RLS lets the right people see the right things.

I'll drive the testing using browser automation + direct DB / edge-function inspection, log every issue I find, and then fix them in priority order.

## QA Walkthrough (in order)

### 1. Auth & org setup
- Sign up a fresh user → confirm `users` row + default `user_roles` row are created
- Verify `organizations` / org assignment works
- Log out / log back in
- Test password reset and Google OAuth (if enabled)

### 2. Clients
- Create a client, edit it, upload a logo
- Verify access_level toggle works
- Soft-delete and confirm it disappears from lists

### 3. Solicitation intake
- Create a solicitation, attach to a client
- Upload a real PDF (use a sample RFP)
- Confirm `documents.status` transitions: `uploading` → `processing` → `ready`
- Inspect `document_sections` and `extracted_text` — was the PDF actually parsed?

### 4. AI analysis pipeline (the riskiest area)
For each edge function, trigger it from the UI, then check logs + DB:
- `analyze-solicitation` → `solicitations.ai_summary`, `key_requirements`, `evaluation_factors`
- `extract-entities` → `extracted_entities` rows with citations
- `identify-risks-opportunities` → `risks` + `opportunities` with source_quote
- `generate-questions` → `strategic_questions`
- `compare-solicitations` → `prior_solicitations.changes_identified`
- `generate-report` → `executive_reports.content` + file in `reports` bucket

For each: confirm AI output is grounded (has citations), not hallucinated, and the UI renders it cleanly.

### 5. Collaboration
- Add annotations from two browser sessions, confirm realtime updates
- Check that you can only edit your own annotations
- Verify activity feed logs all events
- Test team presence indicator

### 6. Reports & exports
- Generate each report type
- Download as PDF and Word — open the files, confirm they're not broken
- Publish a report, mark client-accessible

### 7. Client portal (isolation test — critical)
- Invite a client user → accept invite → log in at `/portal/login`
- Confirm client only sees their org's solicitations
- Test all 3 access_levels: `full`, `summary`, `restricted` — verify documents/annotations/questions are properly hidden
- Try to access another client's solicitation by URL guessing — must 404/403
- Submit a support message → confirm staff sees it

### 8. Cross-cutting checks
- Global search (Cmd+K) returns correct scoped results
- Error boundaries catch a thrown error gracefully
- Loading skeletons appear on slow networks
- Mobile viewport (375px) — main pages don't break
- Console is clean (no React warnings, no 401/403 spam)

### 9. Security & DB hygiene
- Run Supabase linter
- Run security scan
- Manually review RLS on `executive_reports`, `annotations`, `documents`, `client_users`
- Confirm no secret keys in client bundle

## Deliverable

A categorized issue list (Blocker / Major / Minor / Polish) with each issue fixed in a focused commit, plus a short "ready for internal use" sign-off summary at the end.

## Notes

- I'll need you logged into the preview so I can drive the browser as a real user. You're currently on `/login` — please sign in first.
- For the portal isolation test I'll need either an existing client user or permission to create a test one.
- Expect this to surface 5–15 issues; we'll triage together if anything is bigger than a quick fix.
