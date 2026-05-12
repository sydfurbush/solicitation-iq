## Goal
Add in-app per-phase help docs (sheet panel), color-code phase tabs, and improve phase progress visibility.

## Decisions locked
- Help icon placement: **C** — icon on each top-level phase tab AND on each Deep Dive sub-tab.
- Doc format: **A** — hand-authored React components per phase (no new deps).
- Phase color palette: **A** — Phase 1 blue, Phase 2 violet, Phase 3 amber, Phase 4 emerald.
- Progress bar style: **A** (richer stepper with gradient connectors + sub-step counter) — assumed; can swap to B during build.

## 1. Phase color tokens
Edit `src/index.css` and `tailwind.config.ts`:
```text
--phase-1: 217 91% 60%   (blue)
--phase-2: 262 83% 63%   (violet)
--phase-3: 38  92% 55%   (amber)
--phase-4: 152 69% 42%   (emerald)
+ matching --phase-N-soft (same hue, ~12% lightness overlay via /15 alpha)
```
Expose Tailwind classes `bg-phase-1 / text-phase-1 / border-phase-1` (and 2/3/4) plus `*-soft` variants.

## 2. Help docs (hand-authored React)
New folder `src/features/solicitations/help/`:
- `phase1.tsx`, `phase2.tsx`, `phase3.tsx`, `phase4.tsx`
- Each exports `{ title, summary, Body }` where `Body` is a React component using shared primitives (`<HelpSection>`, `<HelpStep>`, `<HelpCallout>`).
- Shared template per doc: **Purpose · How it works · Step-by-step · Outcome · Why it matters · Client participation · Tips**.
- Phase 2 doc additionally documents the 3 sub-steps (RTM, Section analysis, Gaps).

## 3. PhaseHelpPanel component
New `src/features/solicitations/components/PhaseHelpPanel.tsx`:
- Trigger: small ghost icon button (`BookOpen` from lucide) sized `h-7 w-7`.
- Opens shadcn `Sheet` on the right (`side="right"`, width `sm:max-w-xl`).
- Sheet header shows phase number badge in phase color + title + Print button.
- Body wrapped in `ScrollArea`.
- Print: `window.print()` with a print stylesheet (`src/styles/help-print.css`) that hides `[data-print="hide"]` and shows only `#phase-help-printable`.
- Closes on outside click (default Sheet behavior) and on route change (effect on `location.pathname`).
- Props: `phase: PhaseType`, optional `subStep` to deep-link Phase 2 sub-doc.

## 4. Color the phase nav + indicators
- `src/pages/SolicitationDetail.tsx`: replace the four `NavBtn` phase entries with a new `PhaseNavBtn` that accepts `phase` and applies `border-b-2 border-phase-N` + `text-phase-N` when active, soft-tinted hover. Also mount `<PhaseHelpPanel phase={...} />` next to each phase tab label.
- `src/features/solicitations/components/PhaseIndicator.tsx`: numbered circles use the matching phase color (done = filled phase color, current = phase color with pulsing ring `ring-2 ring-phase-N/40 animate-pulse`, future = muted). Connector lines thicken to `h-[3px]` and use phase-color gradient for completed segments.
- `src/pages/SolicitationDeepDive.tsx`: render `<PhaseHelpPanel phase="phase_2_deep_dive" subStep={tab} />` next to each `TabsTrigger` (RTM / Section analysis / Gaps).

## 5. Sub-step progress meter
Inside the phase strip card on `SolicitationDetail.tsx`, below the `PhaseIndicator`:
- Add a thin `Progress` bar tinted with the **current** phase color, value = `(completedSteps / totalSteps) * 100`.
- Counts derived locally:
  - Phase 1: documents/questions/risks counts already on `s` — treat each PHASE_1_STEPS item as "done" if its associated count > 0; overview always done.
  - Phase 2: derive from existing `useRequirementItems`, `useSectionAnalyses`, `useCapabilityGaps` hooks (already lazy-loaded via Deep Dive page — query them at this level, cached).
  - Phase 3 / Phase 4: 1 step each, done if `solicitation_phases.status = complete`.
- Caption: `"In progress · 2 of 5 steps"` / `"Complete"` / `"Not started"`.

## Files

**New**
- `src/features/solicitations/help/phase1.tsx`
- `src/features/solicitations/help/phase2.tsx`
- `src/features/solicitations/help/phase3.tsx`
- `src/features/solicitations/help/phase4.tsx`
- `src/features/solicitations/help/primitives.tsx` (HelpSection/Step/Callout)
- `src/features/solicitations/components/PhaseHelpPanel.tsx`
- `src/features/solicitations/components/PhaseProgressBar.tsx`
- `src/styles/help-print.css`

**Edit**
- `src/index.css` — phase color tokens + import print css
- `tailwind.config.ts` — phase color extensions
- `src/features/solicitations/components/PhaseIndicator.tsx` — color + pulse + thicker connectors
- `src/pages/SolicitationDetail.tsx` — phase-colored nav, mount help panels, mount progress bar
- `src/pages/SolicitationDeepDive.tsx` — sub-tab help panels

No backend / DB / dependency changes.