## Problem

The top stepper (`PhaseIndicator`) colors each phase distinctly using design tokens `--phase-1` (blue), `--phase-2` (purple), `--phase-3` (amber), `--phase-4` (green). The phase cards in `PhaseHub` (Workflow tab) ignore these tokens — the index circle and "In progress / Done" badges use generic `--primary` / `--accent` colors. Result: Phase 1 shows blue in the stepper but green in the card; Phase 2 shows purple in the stepper but blue in the card.

## Change

Update `src/features/solicitations/components/PhaseHub.tsx` so each `PhaseCard` is themed by its own phase token, matching the stepper.

Per phase card:
- Index/check circle background: `bg-[hsl(var(--phase-N))]` with white text when active or done (replacing today's `bg-primary` / `bg-accent/15`).
- Highlight ring on the active card: `border-[hsl(var(--phase-N)/0.6)] ring-[hsl(var(--phase-N)/0.3)]` (replacing `border-primary/60 ring-primary/30`).
- "In progress" / "Done" state badge: tinted with the phase color (`bg-[hsl(var(--phase-N)/0.15)] text-[hsl(var(--phase-N))] border-[hsl(var(--phase-N)/0.3)]`). "Not started" stays muted.
- Primary "Open Phase N" button when active: use the phase color as background (custom inline style or a small variant block) instead of the default primary blue.

Implementation details:
- Add a `PHASE_COLOR_CLASSES` map in `PhaseHub.tsx` (mirroring the maps already in `PhaseIndicator.tsx` and `SolicitationDetail.tsx`) keyed by `PhaseType`, returning the className strings for ring/border, bg, text, and badge.
- Pass the phase key into the existing badge/circle/button JSX and swap the static `primary`/`accent` classes for the per-phase classes.
- Keep the sub-step `StateDot` and the dashed "Client approval" block neutral (no phase tinting) — only the card's identity elements change so the cards stay readable.

No behavior, data, or layout changes. Tailwind already supports the arbitrary `hsl(var(--phase-N))` classes elsewhere in the codebase, so no config changes are needed.

## Files

- `src/features/solicitations/components/PhaseHub.tsx` — add color map, apply per-phase classes to index circle, card ring, state badge, and Open button.
