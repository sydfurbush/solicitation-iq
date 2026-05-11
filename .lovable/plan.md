
# Phases 2-4 build plan

Today the 4-step indicator (Initial → Deep Dive → Outline → Win Themes) is just a label. `solicitations.current_phase` and the `solicitation_phases` table exist, but no UI or AI is wired to phases 2-4. This plan adds them.

## Phase 1 — Initial (already built, no change)
Documents, AI summary, requirements, evaluation factors, questions, risks/opportunities.

## Phase 2 — Deep Dive (new)
Three sub-tabs on a new `/solicitations/:id?tab=deep-dive` page.

**a. Requirements Traceability Matrix (RTM)**
- New table `requirement_items`: `id, solicitation_id, req_number, shall_text, source_section (L/M/C/PWS), source_document_id, page_number, source_quote, compliance_owner, proposal_volume, proposal_section, status (open/in_review/covered/waived), notes, is_ai_generated, created_at, updated_at`.
- New edge function `extract-requirements`: pulls every "shall/must/will" statement from `document_sections`, numbers them, returns structured rows with citations. Uses Lovable AI Gateway (`google/gemini-2.5-pro`).
- UI: sortable/filterable table, inline edit of owner + proposal mapping, CSV export.

**b. Section-by-section analysis**
- New table `section_analyses`: `id, solicitation_id, section_code (L/M/C/etc.), summary, requirements_count, scoring_weight, risk_flags jsonb, source_citations jsonb, updated_at`.
- New edge function `analyze-sections`: walks Section L (instructions), Section M (evaluation factors + weights), Section C/PWS (scope), produces structured breakdown.
- UI: accordion per section with summary, weights, flagged risks linking to the existing risks list.

**c. Gap & capability analysis**
- New table `capability_gaps`: `id, solicitation_id, requirement_id (→requirement_items), gap_type (capability/past_performance/certification/teaming), severity, description, recommendation (build/buy/team/no_bid), client_note, updated_at`.
- New edge function `analyze-gaps`: cross-references RTM against `clients.metadata.capabilities` (new field), flags gaps, suggests teaming.
- UI: list grouped by gap_type with severity badges and a "no-bid trigger" banner if any critical gap is unresolved.

## Phase 3 — Outline (new)
- New table `proposal_outlines`: `id, solicitation_id, version, title, generated_at, generated_by, metadata jsonb`.
- New table `outline_nodes`: `id, outline_id, parent_id, sort_order, volume, section_number, title, page_allocation, assigned_to (uuid), source_l_reference, linked_requirement_ids uuid[], notes`.
- New edge function `generate-outline`: takes Section L instructions + RTM, produces Volume → Section → Subsection tree with page allocations. Uses Lovable AI.
- UI: `/solicitations/:id?tab=outline` with collapsible tree, drag-reorder (dnd-kit), inline edit, "Regenerate" and "Export to Word" buttons (reuses `wordGenerator.ts`).

## Phase 4 — Win Themes (new)
- New table `win_themes`: `id, solicitation_id, title, theme_statement, discriminators text[], ghosting_points text[], proof_points text[], linked_outline_node_ids uuid[], linked_requirement_ids uuid[], status (draft/approved/rejected), is_ai_generated, created_by, updated_at`.
- New edge function `generate-win-themes`: input = RTM + Section M evaluation factors + client capabilities + incumbent intel; output = 5-8 candidate themes with discriminators, ghosting points, proof points, citations.
- UI: `/solicitations/:id?tab=win-themes` — card grid, "Generate suggestions" button (AI), inline edit, link-to-outline-section picker, approve/reject toggle.

## Phase progression (manual)
- Repurpose the existing `solicitation_phases` table to track per-phase state.
- Each phase page shows a footer with **"Mark phase complete & advance to [next]"** button → updates `solicitations.current_phase` and inserts/updates the `solicitation_phases` row (sets `completed_at`, `completed_by`).
- `PhaseIndicator` is already click-aware — wire `onPhaseClick` to navigate between tab routes; future phases stay clickable but show an "Advance previous phase first" empty state.

## UI changes
- `SolicitationDetail.tsx`: add 3 tabs (Deep Dive, Outline, Win Themes) alongside existing tabs; each tab renders a new page component.
- `PhaseIndicator`: pass `onPhaseClick` so users can jump between phase tabs.
- New components: `DeepDiveTab`, `RTMTable`, `SectionAnalysisAccordion`, `GapsList`, `OutlineTree`, `WinThemesGrid`, `AdvancePhaseButton`.

## Reports
Extend `generate-report` with three new report types: `deep_dive_brief`, `proposal_outline`, `win_themes_brief` — deterministic builders (same pattern we used for `questions_brief`) so nothing gets dropped.

## Out of scope
- Real proposal authoring (writing volumes inline) — outline only.
- Color team reviews (pink/red/gold) — can be a Phase 5 later.
- Pricing models, BOE, staffing plans.

## Build order (suggested)
1. Migration: new tables + indexes + RLS (mirrors existing `staff manage / view` policy pattern).
2. Phase progression plumbing + clickable PhaseIndicator + AdvancePhaseButton.
3. Deep Dive: RTM (table + edge fn + UI), then sections, then gaps.
4. Outline: table + edge fn + tree UI + Word export.
5. Win Themes: table + edge fn + grid UI.
6. Report types for each.

Let me know which phase to start with — I recommend shipping phase progression + Deep Dive RTM first since everything else depends on requirements being numbered.
