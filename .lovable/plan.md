# Route risks to the client + surface in portal and reports

## Goal
Shift the "Ask the agency" action on a risk to instead **send the risk to the client** for them to edit mitigation notes and mark it mitigated. Expose the full Risk Mitigation tracker in the client portal, and include mitigation status in the executive report.

## 1. Database

Add a small handoff state on `risks` so staff can route a risk to the client and the client can act on only what's been sent.

- `sent_to_client` boolean default false
- `sent_to_client_at` timestamptz null
- `sent_to_client_by` uuid null (staff user)
- `client_note` text null (optional separate field; for now we will reuse `mitigation_strategy` for the client's edits — see Open question)

RLS additions on `public.risks`:
- **Client SELECT**: client users of the solicitation's client (any access level) may view all risks for that solicitation.
- **Client UPDATE**: client users with `access_level = 'full'` may update `mitigation_strategy` and `is_mitigated` on risks where `sent_to_client = true`.

(Mirrors the pattern already used for `strategic_questions`.)

## 2. Staff side — "Ask the agency" → "Send to client"

`src/features/analysis/components/RiskMitigationTracker.tsx` (`UnmitigatedRow`):
- Remove the `ConvertRiskToQuestionDialog` import + usage.
- Replace the **Ask the agency** button with **Send to client**:
  - On click, `useUpdateRisk` sets `sent_to_client = true`, `sent_to_client_at = now()`, `sent_to_client_by = auth user`.
  - Toast: "Sent to client for review."
  - When `sent_to_client` is true, show a small badge ("Awaiting client") next to the Open pill and disable the Send button (with an "Unsend" option to clear the flag).
- `MitigatedRow`: show a "Mitigated by client" tag when `is_mitigated && sent_to_client` and the last updater is a client user (best-effort using `updated_at` comparison with `sent_to_client_at`).

Files touched: `RiskMitigationTracker.tsx` only. Delete or stop referencing `ConvertRiskToQuestionDialog` from this component (leave the component file for other potential reuse, but it is no longer wired from the risk tracker).

## 3. Client portal — Risks tab

New tab inside `src/pages/portal/PortalSolicitationDetail.tsx`, visible when `hasFullAccess`:

- Tab label: **Risks**.
- Contents: a client-flavored `RiskMitigationTracker`:
  - Same two-group layout (Open / Mitigated) with summary header + progress bar.
  - Client sees **all** risks for visibility, but Edit/Save/Mark mitigated/Reopen controls are only enabled on rows where `sent_to_client = true`.
  - Rows not sent: read-only card showing severity, title, description.
  - Sent + open: editable `mitigation_strategy` textarea, "Save notes" + "Mark mitigated" buttons.
  - Mitigated: read-only notes + "Reopen" button (only for sent risks).
- Reuse `useRisks` / `useUpdateRisk` / `useMarkRiskMitigated` — RLS handles the gating.

New file: `src/features/portal/components/ClientRiskTracker.tsx`.

## 4. Reports — include mitigation status

`supabase/functions/generate-report/index.ts`:
- The `ctx.risks` payload already feeds the prompt — extend the prompt body in `prompts.ts` and `generate-report` to instruct the model to:
  - In `executive_summary` Strategic Assessment "TOP RISKS" rows: append `(Mitigated)` to the title when `is_mitigated`.
  - In `risk_assessment` Risk Overview: report counts split as "open vs mitigated".
  - In Critical Risks: render each risk's `mitigation_strategy` and mark status as "Open" or "Mitigated".

`src/features/reports/templates/prompts.ts`: update the two relevant prompt strings.

No template/block schema change required — the model already produces tables/text blocks.

## 5. Out of scope
- No changes to the standalone `RisksList` (Risks tab in the staff app).
- `ConvertRiskToQuestionDialog` is no longer used by the risk tracker; questions tab is untouched.
- No new notification type for "risk sent to client" in this pass (can add later via `client_notifications` if desired).
- Competitive Position scoring untouched.

## Open question
Should the client's edited notes overwrite `mitigation_strategy` (single field, simplest), or live in a separate `client_note` column so staff can see "staff draft vs client edit"? Default to **single field** unless you say otherwise.

## Technical notes
- Migration ordering: add columns + RLS first, then ship code in a second pass.
- `useMarkRiskMitigated` already accepts `{ id, isMitigated }` — no hook changes needed.
- RLS update policy must NOT allow client to flip `sent_to_client` back to false (use a `WITH CHECK` that requires `sent_to_client = true`).
