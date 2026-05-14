
# Implementation Plan — Option A: Client Question Triage → Clarification Package

Approved flow: Client triages each AI-generated question (Remove / Clarify / Hold / Defer), submits decisions, analyst gets notified, AI drafts formal clarification requests per "Clarify" item, analyst edits/compiles a package, client downloads and submits to the agency.

Plus: a new Help article documenting this workflow.

---

## 1. Database migration

Add columns to `strategic_questions`:
- `client_decision` enum `client_question_decision` (`pending | remove | clarify | hold | deferred`), default `pending`
- `client_note` text
- `client_decision_by` uuid → `client_users(id) ON DELETE SET NULL`
- `client_decided_at` timestamptz
- `clarification_draft` text (AI output, analyst-editable)
- `clarification_status` enum `clarification_status` (`none | drafting | ready | submitted`), default `none`

New table `clarification_packages`:
- `id`, `solicitation_id` (FK), `status` (`draft | ready | submitted`), `pdf_path`, `docx_path`, `compiled_by`, `compiled_at`, `submitted_at`, `submitted_by` (client_users), `notes`, timestamps.
- RLS: solicitation members manage; client users (full access) can SELECT and update `submitted_at/submitted_by` for their client's solicitations.

Extend RLS on `strategic_questions`:
- New UPDATE policy for client users (full access, same client) limited to setting `client_decision`, `client_note`, `client_decision_by`, `client_decided_at`. Implement as a trigger that rejects updates to other columns when the actor is a `client_user`, since column-level grants don't compose cleanly with PostgREST.

Extend `client_notifications.notification_type` allowed values (text column, no enum change needed): `package_ready`.

## 2. Edge function: `draft-clarification-request`

Input: `{ questionId }` (or `{ solicitationId }` for batch).
- Loads question + client_note + source citation/quote + solicitation metadata.
- Calls Lovable AI (`google/gemini-2.5-pro`) with structured Output (Zod) returning four fields:
  1. `reference` — section/page/paragraph
  2. `quotedText` — verbatim excerpt
  3. `concern` — plain-English ambiguity statement
  4. `requestedClarification` — formal question to the agency
- Stores formatted markdown in `clarification_draft`, sets `clarification_status='drafting'`.
- `verify_jwt = true` (default); analyst-only via RLS.

Reuse existing `_shared/aiClient.ts` pattern.

## 3. Client portal — Review Questions tab

New route: `/portal/solicitations/:id/review-questions` (and a tab on `PortalSolicitationDetail`).

Component `ClientQuestionTriage.tsx`:
- Lists all `strategic_questions` for the solicitation, grouped by category.
- Per-row: question text, rationale, source citation (with quote tooltip), AI priority badge, current decision pill.
- Action group (radio buttons): **Remove · Clarify · Hold · Defer**.
- When `Clarify` selected: required textarea ("What's unclear or what outcome do you want?").
- Optional inline edit of `question_text` (saves on blur).
- Sticky header: "Decided X of Y · Due in N days" (uses `questions_due_date`).
- Bulk action bar: select-all → mark Hold/Remove.
- Footer: **"Send decisions to analyst"** button — disabled until every row decided.

Submit handler:
- Writes all rows; inserts `activity_log` entry; inserts `client_notifications` rows for assigned analysts (looked up via `solicitation_assignments`); after submit, the page becomes read-only with a banner ("Decisions sent — awaiting analyst draft").

Hook: `useClientQuestionDecisions.ts` (mutations + react-query).

## 4. Analyst — Clarification Drafts tab

Add a 4th view tab on `SolicitationQuestions.tsx`: **Clarifications** (visible once at least one question has `client_decision='clarify'`).

Component `ClarificationDrafts.tsx`:
- Lists "Clarify" questions, each as an editable card showing: original question, client_note, source quote, and the four AI-drafted parts (collapsible).
- Buttons per card: **Draft with AI**, **Regenerate**, **Mark ready**, **Send back to client** (sets decision back to `deferred` with analyst note via `client_notifications`).
- Top-bar action: **Draft all pending** (calls edge function in parallel).
- When all are `ready`: **Compile package** button enabled.

Compile package:
- Reuses existing `pdfGenerator` / `wordGenerator` with a new template `clarificationPackage` (cover, contents table, one section per item with the four parts).
- Saves both files to `reports` bucket under `clarifications/{solicitationId}/{packageId}.{pdf,docx}`.
- Inserts `clarification_packages` row (`status='ready'`).
- Notifies client users: `notification_type='package_ready'`, link to portal.

## 5. Client portal — Final submission

On `PortalSolicitationDetail`, new "Clarification Package" card (visible when a `ready` package exists):
- Download PDF / Download DOCX.
- **Mark as submitted** button → opens dialog asking for submission date + optional confirmation reference; sets `submitted_at/submitted_by` on the package and flips `is_submitted=true`, `submitted_at=now()` on each included `strategic_questions` row.
- After submission: package becomes read-only; analyst gets a notification ("Client submitted package on …").
- Optional: paste agency response later → fills `agency_response` per question (existing column).

## 6. Notifications wiring

Reuse `useClientNotifications`. Add internal `useStaffNotifications` (or use existing `activity_log` + a small analyst notification toast) for two events: `client_review_complete`, `client_package_submitted`.

## 7. Help article

Add `src/features/settings/help/ClientQuestionWorkflowArticle.tsx` and register it in `HelpTab.tsx` with a `ClipboardCheck` icon and title **"Client question review & clarification workflow"**.

Article sections:
1. **Overview** — one-paragraph summary + the diagram below.
2. **Roles** — what the analyst, client, and AI each do.
3. **Step-by-step**
   - Analyst generates questions
   - Client triages (Remove / Clarify / Hold / Defer) with note rules
   - Client submits decisions
   - Analyst drafts clarifications (AI-assisted)
   - Analyst compiles package
   - Client downloads and submits to agency
   - Recording the agency's response
4. **Decision types explained** — when to use each, with examples.
5. **Tips** — due-date awareness, editing question text, using "Hold" as competitive intel, "Send back" for revisions.
6. **FAQ** — "Can two clients review at once?", "Can I undo a submission?", "Where do Hold questions go?"

ASCII flow diagram inside the article:

```text
Analyst generates  ->  Client triages      ->  Client submits decisions
       |                                              |
       v                                              v
 Hold list (internal)                       Analyst drafts (AI)
                                                      |
                                                      v
                                              Analyst compiles package
                                                      |
                                                      v
                                              Client downloads + submits
                                                      |
                                                      v
                                              Agency response captured
```

Also add an FAQ row to `Help.tsx`: "How do clients review and submit questions?" → points to the new article.

## 8. Out of scope (this pass)

- Email notifications (in-app only for v1; can layer Resend later).
- Multi-round revision history per clarification item (single edit cycle for now; "Send back to client" already covers basic revisions).
- Editing the compiled package after submission.

## 9. Verification

1. As analyst, generate questions on a test solicitation.
2. Switch to a portal client user with full access → open Review Questions → decide all (mix of all 4 types) → submit.
3. Switch back to analyst → see notification → open Clarifications tab → "Draft all" → edit one → mark all ready → compile.
4. Switch to client → download PDF and DOCX → "Mark submitted".
5. Confirm `is_submitted=true` on involved questions and `clarification_packages.status='submitted'`.
6. Open Settings → Help → new article renders with diagram and all sections.
