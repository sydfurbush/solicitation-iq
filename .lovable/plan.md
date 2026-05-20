# Show all risks in tracker + allow un-mitigating

## Goal
In the Risk mitigation tracker (Phase 1 → Risks step), surface mitigated risks alongside open ones, and let users move a risk back to "open".

## Changes

### `src/features/analysis/components/RiskMitigationTracker.tsx`
- Stop filtering to `open` only. Render two groups in order:
  1. **Open** (unmitigated) — current `UnmitigatedRow` behavior unchanged.
  2. **Mitigated** — new compact `MitigatedRow` showing severity badge, a green "Mitigated" pill, the risk title, the saved mitigation notes (read-only, collapsed if long), and a single **Reopen** button.
- Add a small section header / count for each group (e.g. "Open (3)", "Mitigated (2)"). If a group is empty, hide it.
- Keep the existing summary header (`X of Y risks mitigated`, percentage, progress bar) as-is.
- Replace the current "All risks have been mitigated." empty state with the mitigated list; show that message only when `total === 0`.

### Reopen action
- Wire **Reopen** to the existing `useMarkRiskMitigated` hook, calling `mutateAsync({ id, isMitigated: false })`.
- Show a confirm dialog ("Reopen this risk? It will move back to Open.") to prevent accidental clicks.
- Toast on success / error using the existing `toast` helper.

## Out of scope
- The standalone `RisksList` (Risks tab) already supports filtering by status — no change there.
- No schema / hook changes; `useMarkRiskMitigated` already accepts the boolean.
- No changes to Competitive Position scoring.

## Technical notes
- `useMarkRiskMitigated` in `src/features/risks/hooks/useRisks.ts` already takes `{ id, isMitigated }`, so reopening is just passing `false`.
- New `MitigatedRow` lives in the same file as `UnmitigatedRow` to keep the tracker self-contained.
