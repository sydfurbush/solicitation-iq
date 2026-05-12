## Goal

Replace the flat 11-tab solicitation page with a phase-driven workspace that mirrors the consultant's process: a default **Workflow Hub** that summarizes all 4 phases at a glance, plus a slim top navigation that drills into each phase's steps. Header gets a single Actions menu; stats move into Phase 1.

---

## New information architecture

```text
Solicitation header  (title, client, SAM link, status, Actions ▾)
─────────────────────────────────────────────────────────────────
Phase strip          [1 Initial] ─ [2 Deep Dive] ─ [3 Outline] ─ [4 Win Themes]   |  Proposal due
─────────────────────────────────────────────────────────────────
Top nav (slim)       Workflow ·  Phase 1 ▾  ·  Phase 2 ▾  ·  Phase 3 ▾  ·  Phase 4 ▾  ·  Workspace ▾
                                                                                          (Reports · Comparison · Activity)
─────────────────────────────────────────────────────────────────
Content pane         Renders the chosen view
```

- **Workflow** (new default) = Phase Hub landing.
- **Phase 1 ▾** opens a popover/menu of its 5 steps: Overview · Documents · Analysis · Questions · Risks & Opportunities.
- **Phase 2/3/4 ▾** open directly to their single step (Deep Dive / Outline / Win Themes); the dropdown still lists internal sub-views where relevant (e.g. Deep Dive → RTM, Sections, Gaps).
- **Workspace ▾** groups the cross-cutting tools: Reports, Comparison, Activity.
- The existing `?tab=` query param is preserved so deep links keep working.

## Workflow Hub (new landing view)

A grid of 4 phase cards + a Workspace strip below.

```text
┌──────────────────────────────┐  ┌──────────────────────────────┐
│ ① Initial            ●done   │  │ ② Deep Dive       ◐ active  │
│ Set up the file               │  │ RTM, sections, gaps          │
│  ✓ Overview                   │  │  · Deep Dive →               │
│  ✓ Documents (11)             │  │                              │
│  ✓ Analysis                   │  │                              │
│  ✓ Questions (127)            │  │                              │
│  ✓ Risks & Opps (12 / 0)      │  │                              │
│  Open Phase 1 →               │  │  Open Phase 2 →              │
└──────────────────────────────┘  └──────────────────────────────┘
┌──────────────────────────────┐  ┌──────────────────────────────┐
│ ③ Outline           ○ todo   │  │ ④ Win Themes        ○ todo  │
└──────────────────────────────┘  └──────────────────────────────┘

Workspace:  [Reports]  [Comparison]  [Activity]
```

Per card (light guidance, no gating):
- Phase number, name, status dot (done / active / todo) derived from `solicitation_phases.status` + `current_phase`.
- Step list with status dot only — no checklist enforcement, no owners, no due dates.
- Counts pulled from existing `documents_count`, `questions_count`, etc. for relevant steps.
- "Open Phase N →" jumps to that phase's first step.
- The current phase card is visually emphasized (primary border / subtle gradient).

## Phase 1 view (Initial)

When the user enters Phase 1 from the top nav, the page renders:

1. A **Phase 1 toolbar**: phase title + sub-step pills (Overview · Documents · Analysis · Questions · Risks).
2. **Stat strip** (Documents · Questions · Risks · Opportunities) — moved from the global header to live only inside Phase 1 / Overview, since they are Phase-1 KPIs.
3. The selected sub-step content (existing components reused, no behavior changes).

## Phase 2 / 3 / 4 views

Same shell: a phase title bar + a "Mark phase complete & advance" button (existing `AdvancePhaseButton`) on the right, then the existing single-step content (Deep Dive / Outline / Win Themes). Sub-tabs already inside Deep Dive (RTM, Sections, Gaps) stay where they are.

## Header changes

- Keep visible: status pill + Change, Annotations, Team Presence.
- Collapse into a single **Actions ▾** dropdown:
  - Edit
  - Generate report
  - Share (copy link)
  - Archive
  - Delete (destructive style at the bottom, with the existing confirm dialog)
- The phase strip + proposal-due card stays as-is (it is the spatial anchor users circled in the screenshot).

## Routing & state

- Single source of truth remains `?tab=...`.
- New tab values:
  - `workflow` (default landing)
  - `phase-1` with sub-step in `?step=overview|documents|analysis|questions|risks`
  - `phase-2`, `phase-3`, `phase-4` (sub-step optional, defaults to the phase's main step)
  - `reports`, `comparison`, `activity` (unchanged)
- Backwards compatibility: legacy values (`overview`, `documents`, `deep-dive`, `outline`, `win-themes`, …) get redirected to the new `phase-N?step=…` shape on load so existing bookmarks still resolve.
- `PHASE_TAB` map (used by `PhaseIndicator` clicks and `AdvancePhaseButton`) is updated to point at the new `phase-N` values.

## Files affected

- `src/pages/SolicitationDetail.tsx` — replace the 11-tab block with the new Phase Hub + slim top nav, move stat cards into Phase 1, collapse header actions into a dropdown, add legacy-tab redirect.
- `src/features/solicitations/hooks/usePhaseProgression.ts` — update `PHASE_TAB` to the new tab keys.
- `src/features/solicitations/components/PhaseHub.tsx` *(new)* — the 4-card landing grid.
- `src/features/solicitations/components/PhaseShell.tsx` *(new)* — phase title bar + sub-step pills + content slot used by all 4 phase views.
- `src/features/solicitations/components/SolicitationActionsMenu.tsx` *(new)* — the consolidated Actions ▾ dropdown (wraps Edit dialog + share/archive/delete handlers).
- `src/features/solicitations/components/PhaseIndicator.tsx` — minor: clicking a phase routes to `phase-N` instead of the old per-tab key.

No backend, no schema changes, no behavior changes inside the existing step components (Documents, Analysis, Deep Dive, etc.) — they are only re-mounted under the new shell.

## Out of scope

- Step checklists, owner assignment, due dates per step, gating advancement (chose Light guidance).
- Any change to the per-step pages themselves.
- New stats or analytics on the hub cards beyond counts already on `solicitations`.

## Risk / mitigation

- Deep links — handled by the legacy-tab redirect on mount.
- Mobile — the slim top nav becomes a single phase dropdown under `md`; the Phase Hub grid collapses to one column.
- Discoverability of moved stats — Phase 1 / Overview keeps them at the top so anyone landing there still sees the same numbers.
