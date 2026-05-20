# Client participation in Capability Gaps

## Goal

Bring gaps into the client workflow the same way risks now work: the analyst owns gap identification and triage, then "Sends to client" specific gaps so the client can confirm, deny, or add context (e.g., supply past performance, certifications, or teaming info) from the portal. Gaps surfaced to the client also appear in client-facing reports.

Mirrors the existing risk handoff pattern (`sent_to_client` + `guard_client_risk_update` trigger + `ClientRiskTracker`).

## Analyst vs. Client (after this change)

- **Analyst owns**: extracting/regenerating gaps, severity, recommendation (build/buy/team/no-bid), final disposition.
- **Client owns** (per-gap, only when sent): a `client_response` note ("we have this", "use Acme as sub", past-performance pointer) and a `client_confirmed` flag. Cannot change title/description/severity/recommendation.
- Resolution remains the analyst's call.

## Changes

### 1. Database (one migration)

Extend `capability_gaps`:
- `sent_to_client boolean NOT NULL DEFAULT false`
- `sent_to_client_at timestamptz`
- `sent_to_client_by uuid REFERENCES users(id) ON DELETE SET NULL`
- `client_response text`
- `client_responded_at timestamptz`
- `client_confirmed boolean` (nullable: null = no response, true = "we have this capability", false = "gap is real")

RLS:
- Add SELECT policy: client users see only their client's gaps where `sent_to_client = true`.
- Add UPDATE policy: client users can update only their client's gaps where `sent_to_client = true`.
- Add `guard_client_gap_update()` trigger restricting client edits to `client_response`, `client_confirmed`, `client_responded_at` (mirrors `guard_client_risk_update`).

### 2. Analyst UI (`GapsList` in `SolicitationDeepDive.tsx`)

Per gap card, add:
- "Send to client" button (or "Re-send / Sent ✓" badge with timestamp once sent).
- When a client response exists, show it inline: confirmation pill + response text + responded date.

No change to generation, severity, or resolution controls.

### 3. Client portal

Add a `ClientGapTracker.tsx` under `src/features/portal/components/` modeled on `ClientRiskTracker`.
Mount as a new "Gaps" tab in `PortalSolicitationDetail.tsx` (next to the existing "Risks" tab).
For each sent gap, render: title, description, severity, recommendation, plus inputs:
- "We have this capability" / "This is a real gap" / "Not sure" radio (writes `client_confirmed`).
- Free-text response box (writes `client_response`, sets `client_responded_at`).
- Save button. No ability to edit analyst fields.

### 4. Reports

In `src/features/reports/templates/prompts.ts` and `supabase/functions/generate-report/index.ts`, extend the existing gaps section to include `client_confirmed` and `client_response` when present, so the client-facing report reflects the client's input.

## Out of scope

- New AI generation for gaps (analyst still triggers `analyze-gaps`).
- Changing severity/recommendation taxonomy.
- Auto-resolving gaps based on client confirmation (analyst still flips `is_resolved`).
- Notifications/email (handled by existing client-notification infra if it picks up `sent_to_client` automatically; otherwise out of scope here).
