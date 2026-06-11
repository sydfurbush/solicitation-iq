## Goal

Make Phase workspace entry obvious. Today the rail sub-items are clickable but lack affordance, so the workspace feels missing.

## Desktop — "Open Workspace" primary button in the rail

In `src/features/solicitations/components/workspace/PhaseRail.tsx`, when a phase row is active and has `steps`, render a primary CTA directly under the phase title and above the sub-items:

```text
┌ 01  Phase 1: Initial ────────────────┐
│                                       │
│   [ Open Workspace  → ]   ← primary   │
│                                       │
│   • Overview                          │
│     Documents              11         │
│     Analysis                          │
│     Questions              38         │
│     Risks & Opportunities  12         │
└───────────────────────────────────────┘
```

- Button uses `bg-rail-accent text-white`, full-width, small height (h-8), rounded-sm, IBM Plex Sans semibold, right-aligned arrow.
- Clicking calls `onSelect(tab, phase.defaultStep)` — lands on Overview for Phase 1, RTM for Phase 2, Outline for Phase 3, Themes for Phase 4, Draft for Phase 5.
- Sub-item list remains as quick jumps. Active sub-item still gets the accent dot.
- Hover affordance on sub-items: add `hover:bg-white/5 rounded-sm px-2 -mx-2 cursor-pointer` so rows read as clickable.
- When a phase has no sub-steps (Phase 4/5), the CTA replaces the (currently absent) list — clicking enters the workspace.

## Mobile — bottom action sheet

Replace the current "Change ▾" header behavior on `MobilePhaseBar` and add a dedicated workspace launcher:

- Sticky phase bar keeps phase number + label, but the right-side control becomes **"Open Workspace"** (primary pill).
- Tapping it opens a `Sheet side="bottom"` that lists the active phase's workspaces as large rows (44px+ tap targets), each showing label + count badge + chevron.
- Sub-item horizontal pill scroller stays for quick switching once inside a workspace.
- The existing hamburger / left sheet continues to switch between phases.

```text
┌ Workspaces · Phase 1: Initial ────┐
│  Overview                       › │
│  Documents              11      › │
│  Analysis                       › │
│  Questions              38      › │
│  Risks & Opportunities  12      › │
└───────────────────────────────────┘
```

## Files to change

1. `src/features/solicitations/components/workspace/PhaseRail.tsx`
   - Add `OpenWorkspaceButton` inside the active-phase block (expanded rail only).
   - Add hover styles on sub-item buttons.
   - Add new `MobileWorkspaceSheet` component (bottom sheet content).
   - Update `MobilePhaseBar` to expose an `onOpenWorkspaces` callback and render the "Open Workspace" pill.

2. `src/pages/SolicitationDetail.tsx`
   - Add `workspaceSheetOpen` state.
   - Wire `MobilePhaseBar` `onOpenWorkspaces` → opens bottom `Sheet`.
   - Render bottom `Sheet` with `MobileWorkspaceSheet` listing active phase steps, each calling `goTab(tab, step)` then closing.
   - Collapsed-rail variant: in `PhaseRail` collapsed mode, double-click / single click on the active phase chip already routes to `defaultStep` — keep as-is.

## Out of scope

- No backend/data changes.
- No changes to phase progression, advance/approve, or sub-workspace content.
- No restructuring of the canvas; the same components (`SolicitationOverview`, `SolicitationDocuments`, etc.) render once a workspace is opened.

## Acceptance

- From the rail on Phase 1, a clearly labeled "Open Workspace" button is visible; clicking it navigates to `?tab=phase-1&step=overview` and the right canvas updates.
- Hovering any sub-item shows a background highlight and pointer cursor.
- On mobile, tapping "Open Workspace" in the sticky bar opens a bottom sheet listing Overview/Documents/Analysis/Questions/Risks; tapping a row navigates and closes the sheet.
- Phases 2–5 receive the same CTA and route to their `defaultStep`.
