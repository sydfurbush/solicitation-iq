# Solicitation workspace redesign — Archive-style split workspace

Direction locked: **navy + white** palette (`#002147` rail, `#F8FAFC` canvas, blue accent), **Libre Baskerville** display + **IBM Plex Sans** body, **split-screen** structure (phase rail left, focused canvas right). Implements your "focus mode" rule: when working inside a phase, no other phase content is visible.

## Desktop layout

```
┌──────────────────────────────────────────────────────────────────────────┐
│  Top bar:  Solicitations › Agency  │  Title · RFQ# · status   Annot Act │
├──────────────┬───────────────────────────────────────────────────────────┤
│              │  PHASE 1 · INITIAL                                        │
│ WORKFLOW     │  ┌─ Libre Baskerville headline ─────────────────────┐    │
│ PHASES       │  │  Phase 1: Initial Workspace                      │    │
│              │  │  One-line phase purpose                          │    │
│ ● 01 Initial │  └──────────────────────────────────────────────────┘    │
│   · Overview │                                                           │
│   · Documents│  ┌── Active sub-item content (Overview / Documents /     │
│   · Analysis │  │   Analysis / Questions / Risks) — full canvas only ─┐ │
│   · Questions│  │                                                     │ │
│   · Risks    │  │   Cards rendered with white surface, hairline       │ │
│              │  │   borders, uppercase section eyebrows               │ │
│ ○ 02 Deep    │  └─────────────────────────────────────────────────────┘ │
│ ○ 03 Outline │                                                           │
│ ○ 04 Themes  │  ── Phase footer ──                                       │
│ ○ 05 Drafting│  ◄ Previous phase           Request client approval ►    │
│              │                              Open next phase ►           │
│ ──────────── │                                                           │
│ Overall 24%  │                                                           │
│ Due Jul 6 ●  │                                                           │
└──────────────┴───────────────────────────────────────────────────────────┘
```

- **Left phase rail** (`w-72`, navy `#002147`, white text): vertical stepper of all 5 phases with numbered chips. Active phase expands inline to reveal its sub-items (Overview/Documents/Analysis/Questions/Risks for P1, RTM/Section Analysis/Capability Gaps for P2, etc). Inactive phases collapse to a single line. Footer pinned to bottom shows overall % + proposal due countdown.
- **Top bar** (white, 64px): breadcrumb + title + status badge on the left; Annotations + Phase Actions on the right. The old horizontal phase stepper and Workflow tab strip are **removed** — the rail replaces them.
- **Right canvas**: max-w-4xl centered; Libre Baskerville phase headline; only the active sub-item renders. Removes the side-by-side phase-cards grid that's currently on `/solicitations/:id`.
- **Phase transition footer** at bottom of canvas with Previous / Next phase buttons + the primary phase CTA (Request approval / Submit phase).
- **Rail collapse**: click the chip to collapse to a 56px icon rail for max canvas; remembered in localStorage.

## Mobile layout

```
┌────────────────────────┐
│ ← RFQ-…  [status]  ⋮  │  sticky top bar
├────────────────────────┤
│ PHASE 1 · INITIAL  ▼  │  tap to open phase picker sheet
│ Overview              │
├────────────────────────┤
│ [horizontal sub-pills]│  Overview · Documents · Analysis · …  (snap)
├────────────────────────┤
│                        │
│  Focused canvas        │
│  (single sub-item)     │
│                        │
├────────────────────────┤
│  ◄ Prev    Next ►     │  sticky bottom phase footer
└────────────────────────┘
```

- Phase rail becomes a **bottom sheet** opened by tapping the phase chip in the header — same vertical stepper, full-screen drawer.
- Sub-items render as a horizontal **snap-scrolling pill bar** under the phase chip so all sub-items remain one-tap accessible.
- Annotations + Actions move into an overflow `⋮` menu in the top bar.
- Phase Prev/Next sit in a sticky bottom bar so transition stays thumb-reachable.
- Cards stack to single column; tables become card lists; CTA buttons full-width.

## Technical details

Files touched (no business logic changes):

1. `src/index.css` — add tokens: `--rail`, `--rail-foreground`, `--rail-muted`, `--canvas`, `--phase-accent`. Register the two fonts via `<link>` in `index.html` and set Tailwind `fontFamily.display` (Libre Baskerville) + `fontFamily.sans` (IBM Plex Sans).
2. `tailwind.config.ts` — extend `fontFamily` and map new HSL tokens.
3. `src/pages/SolicitationDetail.tsx` — rewrite the page shell:
   - Remove the existing `PhaseIndicator` strip + `Workflow` `NavBtn` row + side-by-side `PhaseHub` cards on the `workflow` tab.
   - Wrap content in `<WorkspaceShell>` with `<PhaseRail>` (new) + `<PhaseCanvas>` (new).
   - Preserve the existing `?tab=phase-1&step=overview` URL contract — the rail just drives the same `goTab` / `setStep` calls.
   - Default landing tab changes from `workflow` to `phase-{currentPhase}` so users land directly in focus mode. A "Workspace overview" entry at the top of the rail still exposes the old multi-phase view for users who want it.
4. New components under `src/features/solicitations/components/workspace/`:
   - `WorkspaceShell.tsx` — flex layout, collapse state.
   - `PhaseRail.tsx` — vertical stepper + expandable active phase, footer with progress + due date. Reuses `PHASES`, `PHASE_TAB`, and the existing sub-step lists already defined in `PhaseNavMenu`.
   - `PhaseCanvas.tsx` — sticky phase header (Libre Baskerville), content slot, transition footer with Prev/Next + primary CTA (reads from `AdvancePhaseButton` + approval hooks).
   - `MobilePhaseSheet.tsx` — bottom sheet using existing shadcn `Sheet`, opened from the header chip.
   - `MobileSubItemPills.tsx` — horizontal snap pill bar.
5. `useIsMobile()` (already in `src/hooks/use-mobile.tsx`) switches the shell between desktop and mobile layouts.
6. `PhaseNavMenu` keeps existing API but is no longer rendered on desktop (the rail replaces it). Still used for sub-step model on mobile pills.

Color tokens added to `index.css` (HSL):

```css
--rail: 214 100% 14%;            /* #002147 */
--rail-foreground: 0 0% 100%;
--rail-muted: 215 20% 65%;
--canvas: 210 40% 98%;           /* #F8FAFC */
--phase-accent: 217 91% 60%;     /* blue rail accent */
--ink: 214 100% 14%;             /* headlines */
```

Only the `SolicitationDetail` page route changes. `PortalSolicitationDetail`, settings, and all other pages keep their current chrome.

## Out of scope

- No backend, schema, or hook changes.
- No changes to the Phase 5 `DraftingWorkspace`/`ComplianceMatrix`/`CompilePanel` internals — they still render inside the new canvas.
- Approvals / annotations behavior unchanged; only their entry points move.

## Recommendation

Ship the **archive-style document workspace** for desktop with the matching **bottom-sheet + pill** mobile pattern. It's the most document-grade of the three directions, gives the strongest focus mode (zero competing phase content on screen), and keeps every existing sub-item one tap from any phase on both form factors.
