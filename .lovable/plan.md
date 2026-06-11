
## Goal

Reclaim vertical space at the top of `SolicitationDetail` so the active phase/step workspace is the focal point. Remove the duplicate solicitation title and the standalone Phase strip card; consolidate progress into the existing Workflow surface.

## Changes (UI only, `src/pages/SolicitationDetail.tsx`)

1. **Remove the redundant title (H1).**
   - The breadcrumb already shows the solicitation title (line 372). Drop the `<h1>{s.title}</h1>` at line 403.
   - Keep client + solicitation number + stage badges row (line 378-402) and the agency/SAM.gov row (line 404-419) as the compact identity strip.

2. **Remove the Phase strip + countdown Card** (lines 458-497).
   - Move the "Proposal due" countdown inline into the header's right-side action cluster (next to status dropdown) as a small chip — preserves the urgency color cue without a full card row.
   - Delete `PhaseIndicator` usage here; phase progression now lives only in Workflow.

3. **Make Workflow the visible default + progress home.**
   - `PhaseHub` (Workflow tab) already renders all three phases with sub-steps, states, and approvals — this becomes the single progress UI.
   - Keep the slim top nav (Workflow | Phase 1 | Phase 2 | Phase 3 | Workspace) as the navigation; selecting a phase still opens its workspace directly.

4. **Result**: ~140px reclaimed above the workspace; phase identity/color still surfaced through the colored Phase nav buttons and the per-phase `PhaseShell` header inside each phase view.

## Options for the countdown placement

Pick one before I build:

- **A. Inline chip in header actions (recommended).** A compact `Clock + "12 days left"` chip next to the status dropdown. Smallest footprint, keeps urgency color.
- **B. Inline next to the H2/breadcrumb on the right.** Same chip, right-aligned at breadcrumb row.
- **C. Move it into the Workflow card header only.** Cleanest header, but countdown is hidden when on a phase tab.

## Out of scope

- No changes to `PhaseHub`, `PhaseShell`, `PhaseIndicator`, or any phase content.
- No route/tab key changes, no backend changes.
- `PortalSolicitationDetail` unchanged.

## Technical notes

- File touched: `src/pages/SolicitationDetail.tsx` only.
- Imports to drop if unused after edit: `PhaseIndicator`, possibly `Card`/`CardContent` (verify other usages before removing).
- `days`, `urgency`, `daysUntil`, `dueUrgency` stay; reused by the new chip.
