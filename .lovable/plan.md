# Multi-Revision Comparison & Visual Diff — All 3 Phases

Builds revision tracking, document-level visual diff, and cumulative/incremental modes for handling pre-sol → amendment → final RFP chains.

## Phase 1 — Revision Timeline + Document Match Panel

**Goal:** Track every package version (pre-sol, amend 0001, amend 0002, final) and instantly see which documents changed between any two.

- New `solicitation_revisions` table: `id, solicitation_id, label, kind (pre_sol|amendment|final|draft), sequence, source (sam|upload|manual), sam_notice_id, received_at, notes`.
- Add `revision_id uuid` to `documents` (nullable). Backfill: existing docs grouped into a synthetic "Initial" revision per solicitation.
- Auto-create revision on:
  - SAM amendment import (extend `sam-import-attachments`)
  - Manual "Add amendment" upload (new button on Documents tab)
- New Comparison-tab UI:
  - **Timeline strip**: horizontal chips `Pre-Sol → Amend 0001 → Amend 0002 → Final` with date + doc count + "new since last view" dot (uses `last_viewed_at` per user via localStorage).
  - **Compare picker**: two dropdowns (A vs B), defaulted to "previous vs latest".
  - **Document Match Panel**: pairs documents by filename similarity + `replaces_document_id` + AI-assisted match for renames. Each row shows status chip (Unchanged / Modified / Added / Removed), % changed, page-count delta, "View diff" button.
- AI re-run scoped per pair: extend `prior_solicitations` to optionally key on `(revision_a_id, revision_b_id)` so each pair caches its own summary.

## Phase 2 — Visual Document Diff

**Goal:** Drill from a "Modified" doc into a true side-by-side / stacked text diff.

- **Section pairing util**: greedy match on `(section_number, section_title)`, fuzzy fallback on title; unmatched flagged added/removed.
- **Change density** per section: `changedChars / totalChars` → drives a sparkline + heatmap.
- **Expanded `ComparisonDiffViewer`** with:
  - Modes: Inline, Side-by-side, Stacked
  - Granularity: Words / Lines
  - Filter: Only show changes
  - Keyboard nav: `j`/`k` for next/prev change, `o` to toggle layout
- **DocumentDiffModal**: section-by-section diff with TOC sidebar + heatmap mini-map down the right edge (scroll-spy of edit hot spots).
- All computed client-side from already-parsed `document_sections` (no new AI calls).

## Phase 3 — Cumulative/Incremental Toggle + Change Report

**Goal:** Answer "what's new since the last amendment?" and "what's changed since day one?" with one toggle.

- Header toggle on Comparison tab:
  - **Incremental**: B vs immediate predecessor of B (e.g., Amend 0002 vs Amend 0001)
  - **Cumulative**: B vs first revision (e.g., Amend 0002 vs Pre-Sol)
- Same UI; baseline auto-resolves based on selected revision.
- **Change Report export** (PDF + Word):
  - Cover page: solicitation, revision pair, mode, generated date
  - Executive summary (AI-generated)
  - Document match table
  - Section-by-section diff with significance + impact callouts
  - Strategic recommendations
- Reuses existing `pdfGenerator.ts` and `wordGenerator.ts`.

---

## Technical details

**Migration** (single):
```
CREATE TABLE solicitation_revisions (...);
ALTER TABLE documents ADD COLUMN revision_id uuid REFERENCES solicitation_revisions(id);
ALTER TABLE prior_solicitations
  ADD COLUMN revision_a_id uuid REFERENCES solicitation_revisions(id),
  ADD COLUMN revision_b_id uuid REFERENCES solicitation_revisions(id);
-- RLS via solicitation_id chain through clients.organization_id (matches existing pattern)
-- Backfill: create one "Initial" revision per solicitation, set documents.revision_id
```

**New files:**
- `src/features/comparison/hooks/useRevisions.ts` — list/create revisions, current pair selection
- `src/features/comparison/hooks/useDocumentMatching.ts` — pair docs across two revisions
- `src/features/comparison/hooks/useSectionDiff.ts` — pair + diff sections of two docs
- `src/features/comparison/components/RevisionTimeline.tsx`
- `src/features/comparison/components/RevisionPicker.tsx`
- `src/features/comparison/components/DocumentMatchPanel.tsx`
- `src/features/comparison/components/DocumentDiffModal.tsx`
- `src/features/comparison/components/DiffHeatmap.tsx`
- `src/features/comparison/components/ComparisonModeToggle.tsx`
- `src/features/comparison/utils/documentMatcher.ts` — filename + AI-assisted matching
- `src/features/comparison/utils/sectionMatcher.ts` — section pairing
- `src/features/comparison/utils/changeReport.ts` — PDF/Word export
- `supabase/migrations/<ts>_revisions.sql`

**Edited files:**
- `src/features/comparison/components/ComparisonDiffViewer.tsx` — add stacked mode, only-changes filter, kbd nav
- `src/features/comparison/utils/diffHelpers.ts` — add `changeDensity()`, `pairSections()`
- `src/features/comparison/hooks/useRunComparison.ts` — accept `{revisionAId, revisionBId}`
- `src/pages/SolicitationComparison.tsx` — wire timeline, picker, mode toggle
- `supabase/functions/compare-solicitations/index.ts` — accept revision pair, pull sections from each revision's docs
- `supabase/functions/sam-import-attachments/index.ts` — auto-create revision on amendment import

**Reused:**
- `diff` library (already installed via `diffHelpers.ts`)
- `document_sections` for section content (already parsed)
- Existing PDF/Word generators

---

## Build order

1. Migration + backfill (revisions table, documents.revision_id, prior_solicitations pair keys)
2. `useRevisions`, `RevisionTimeline`, `RevisionPicker`, hook into Comparison tab
3. `documentMatcher` + `DocumentMatchPanel` with status chips
4. SAM import + manual upload auto-create revisions
5. `sectionMatcher` + expanded `ComparisonDiffViewer` (modes/filters/kbd)
6. `DocumentDiffModal` + `DiffHeatmap`
7. `ComparisonModeToggle` (incremental/cumulative) + baseline resolver
8. `changeReport.ts` (PDF + Word export)

---

## Out of scope

- OCR for scanned amendments not already parsed
- Auto-watcher for new SAM amendment postings (separate feature)
- Auto-merging changes back into the proposal outline
