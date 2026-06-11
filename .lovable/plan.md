## Goal

Collapse the workflow from 5 phases to 3. New Phase 3 ("Proposal Development") contains all sub-steps from the old Phases 3, 4, and 5 in this order:

1. Outline
2. Exhibits
3. Win Themes
4. Draft
5. Compliance Matrix
6. Compile & Package

The top stepper, phase nav bar, Workflow hub, and approvals all reflect the 3-phase model. No data is at risk — DB inspection shows zero rows currently sit in phase_3/4/5.

## What changes

### Database migration (one approval)

1. Collapse data first (safe — no rows in old phases 3/4/5 today, but defensive):
   - `solicitations.current_phase`: any of `phase_3_outline | phase_4_win_themes | phase_5_drafting` → `phase_3_outline`.
   - `solicitation_phases.phase`: same collapse; for each solicitation, merge the three rows into one `phase_3_outline` row (keep earliest `started_at`, latest `completed_at`/status).
   - `phase_approvals.phase`: collapse to `phase_3_outline`; keep the most recent decision per solicitation.
   - `solicitations.status`: `phase_3_active | phase_4_active` → `phase_3_active`.
2. Replace enums (Postgres can't drop enum values in place):
   - Create `phase_type_new` AS ENUM (`phase_1_initial`, `phase_2_deep_dive`, `phase_3_outline`).
   - Alter every column using `phase_type` to the new enum (cast via text).
   - Drop old `phase_type`, rename `phase_type_new` → `phase_type`.
   - Same pattern for `solicitation_status` (drop `phase_4_active`).
3. Re-check default values and triggers that reference removed enum literals.

### Frontend

- `src/lib/validators/solicitation.ts`
  - `PHASES` → 3 entries. `SOLICITATION_STATUSES` drops `phase_4_active`.
- `src/features/solicitations/hooks/usePhaseProgression.ts`
  - `PHASE_TAB` / `TAB_PHASE` shrink to 3. `GATED` becomes `[phase_1_initial, phase_2_deep_dive]` (phase 3 is the final phase; no gate needed past it).
- `src/pages/SolicitationDetail.tsx`
  - Remove `phase-4` and `phase-5` tabs and their PhaseNavBtn / renderers.
  - Replace `PHASE_3_STEPS` with the 6-step list. Route `?tab=phase-3&step=...` to the right component:
    - `outline` → `<SolicitationOutline>`
    - `exhibits` → `<ExhibitsTab>`
    - `themes` → `<SolicitationWinThemes>`
    - `draft` → `<DraftingWorkspace>`
    - `compliance` → `<ComplianceMatrix>`
    - `compile` → `<CompilePanel>`
  - Update `LEGACY_TAB` so old links (`?tab=phase-4`, `?tab=phase-5`, `?tab=win-themes`) redirect to `phase-3` with the appropriate `step`.
  - `phaseLabelByKey`: rename Phase 3 to "Phase 3 · Proposal Development".
- `src/features/drafting/components/Phase5Workspace.tsx`
  - Either delete (functionality moved into Phase 3 steps) or keep as a thin internal helper. Plan: delete and use its three children directly from SolicitationDetail.
- `src/features/solicitations/components/PhaseIndicator.tsx`, `PhaseHub.tsx`, `PhaseShell.tsx`
  - Drop the `phase_4_win_themes` / `phase_5_drafting` entries from `PHASE_LABELS`, `PHASE_COLORS`, `PHASE_BLURBS`. Rename phase 3 label to "Proposal Development".
- `src/features/phases/components/AdvancePhaseButton.tsx`
  - Update `PHASE_LABELS`, gated list, and the "Final phase reached" branch (now triggered after phase 3).
- `src/features/phases/components/PhaseApprovalStrip.tsx`, `ApprovalActionBanner.tsx`, `ApprovalsTimeline.tsx`, `utils/exportApprovalsPdf.ts`
  - Strip references to phase 4 / 5.
- `src/features/solicitations/components/PhaseHelpPanel.tsx`
  - Merge the phase 3 / 4 / 5 help copy into a single phase_3 entry; remove the other two.
- `src/features/solicitations/lib/format.ts`
  - Status labels/classes: drop `phase_4_active`.
- `src/features/exports/lib/exporters.ts`, `src/features/writing-queue/lib/exportAssignments.ts`
  - Update phase label maps.
- `src/pages/Dashboard.tsx`, `src/pages/portal/PortalSolicitationDetail.tsx`
  - Remove references to phases 4 / 5.
- `src/integrations/supabase/types.ts` and `src/types/database.ts`
  - Regenerated after migration; verify the enum types pick up the new shape and adjust any lingering literal references.

### Sub-step state

Inside the merged Phase 3, the existing per-feature "complete" signals stay intact (outline generated, themes saved, draft status, etc.). The Workflow hub card for Phase 3 lists all 6 sub-steps and lights them up as their data exists, mirroring the current Phase 1/2 pattern.

## Out of scope

- No changes to how each sub-feature (outline editor, win themes, drafting editor, compile) works internally — only their routing and labels.
- No rewrite of the AI Assistant, Reports, Comparison, or Activity workspace tabs.

## Verification

1. Confirm migration runs cleanly and `enum_range(NULL::phase_type)` returns 3 values.
2. Open a solicitation that was previously in phase 2 → advance → land in the new Phase 3 with all 6 sub-steps visible.
3. Click each Phase 3 sub-step; each loads its existing component without errors.
4. Visit legacy URLs `?tab=phase-4` and `?tab=phase-5` → auto-redirect to `phase-3` with the right step.
5. PhaseIndicator stepper at top shows 3 circles.
6. Workflow hub shows 3 cards.
