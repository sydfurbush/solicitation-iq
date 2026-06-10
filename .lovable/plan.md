## Problem

On the Risks & Opportunities step, the "Identify risks & opportunities" / "Re-analyze" button only appears in two places:

1. The full empty state (only when there are zero risks AND zero opportunities).
2. Buried inside the small "Mitigation" stats card down in `RisksOpportunitiesDashboard`, below the Competitive Position panel and the Risk/Opportunity action panels.

Because the previous run partially completed (6 risks + 6 opportunities exist), the empty state never renders and the only re-run control is invisible above the fold. The header area the user circled has no action button at all.

We also have a background job (`solicitations.metadata.risks_opportunities_job`) that tracks `processing | completed | failed`. The UI currently ignores that state, so a stuck/failed prior run gives no signal.

## Goal

Always show a clearly placed "Identify risks & opportunities" / "Re-analyze" button in the header of this step, and reflect the background-job status so users can tell whether a run is in-flight or failed.

## Changes

### 1. Add action button in the header — `src/pages/SolicitationRisksOpportunities.tsx`

In the header row (next to the Combined / Risks / Opportunities tabs):

- Add a primary action button:
  - Label: "Identify risks & opportunities" when there are no results, otherwise "Re-analyze".
  - Click handler: existing `handleIdentify` (passes `regenerate: hasAny`).
  - Disabled while `identify.isPending` is true OR a background job is currently `processing`.
  - Shows spinner + label "Analyzing…" when pending/processing.
- Add a small status hint to the right of the title:
  - `processing` → muted text "Analyzing in background…" with a small spinner.
  - `failed` → small destructive-tone badge "Last run failed — click Re-analyze" (with tooltip = the stored `error_message`).
  - `completed` / no job → nothing.

### 2. Read background-job status

Add a lightweight hook (inside the same page file or a tiny new file under `src/features/risks/hooks/`):

- `useRisksOpportunitiesJobStatus(solicitationId)` — selects `metadata` from `solicitations`, returns `{ status, error_message }` from `metadata.risks_opportunities_job`.
- Use a `refetchInterval` of ~3s while `status === "processing"`, otherwise `false`.
- When the status transitions to `completed`, invalidate the `risks` and `opportunities` query keys so the lists refresh even if the page was opened mid-run.

### 3. De-duplicate the buried button — `src/features/analysis/components/RisksOpportunitiesDashboard.tsx`

The Mitigation stats card currently hosts the re-analyze button. Once the header button exists, remove that duplicate button (keep the mitigated/total count). The dashboard already exposes `identify` for nothing else, so that prop usage can be dropped too.

### 4. No edge-function or schema changes

The background-job pattern from the previous step already writes `metadata.risks_opportunities_job`. We only consume it on the client.

## Out of scope

- Reaping stale `processing` jobs server-side (not needed; the mutation poll already errors out after 10 minutes, and a manual re-run overwrites the metadata).
- Redesigning the Competitive Position / mitigation cards.

## Files touched

- `src/pages/SolicitationRisksOpportunities.tsx` — header button + status hint, new hook usage.
- `src/features/risks/hooks/useRisks.ts` (or a new small file) — `useRisksOpportunitiesJobStatus` hook.
- `src/features/analysis/components/RisksOpportunitiesDashboard.tsx` — remove the duplicate button in the Mitigation card.
