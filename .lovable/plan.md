## Goal

Let you click any outline node and see exactly which source document and section the AI used to build it, so you can verify the information.

## Current behavior

The `generate-outline` edge function pulls from three sources for each solicitation:

1. **Section L/M excerpts** — from `document_sections` where `section_number` starts with `L` or `M`, or the title contains "instructions"/"evaluation". Up to 40 sections, 4000 chars each.
2. **Section analyses** — from `section_analyses` (summaries built earlier in Deep Dive).
3. **Requirements** — from `requirement_items` (the RTM, up to 200 shall-statements).

Each generated node already stores:
- `source_l_reference` (e.g. "L.5.2(a)") — shown today as "→ Volume I Instructions"
- `linked_requirement_ids` — shown as the "N reqs" badge

But there is **no stored link back to the actual document or `document_sections` row**, and no UI to inspect what the AI saw. So today you cannot click "Volume I Instructions" and see the underlying RFP page.

## Plan

### 1. Capture source provenance during generation

Edit `supabase/functions/generate-outline/index.ts`:

- Pass the L/M section list to the AI with stable IDs (e.g. `[ref:12]`) and ask the model to return a `source_section_ids` array per node alongside `source_l_reference`.
- Persist a new `source_document_sections` JSONB column on `outline_nodes` containing `[{ document_id, document_name, section_number, section_title, page_start }]` resolved from those IDs.
- Keep `linked_requirement_ids` as-is.

This requires a small migration adding the JSONB column (nullable, default `[]`).

### 2. Show provenance in the outline UI

Edit `src/pages/SolicitationOutline.tsx`:

- Add an "info" / chevron control on each row that opens a popover or expandable panel listing:
  - **Source document** name (linked to the document viewer at the cited page)
  - **Section** number + title
  - **Page**
  - **Linked requirements** (req_number + first 120 chars of shall_text, linked to RTM)
- Reuse the existing `DocumentViewer` deep-link pattern (route to `/solicitations/:id/documents?doc=…&page=…&search=…`) so clicking jumps straight to the highlighted passage in the source PDF.

### 3. Backfill for the existing outline (one-time)

Since your current outline (v1, 73 nodes) was generated before provenance tracking, add a "Re-link sources" button next to Regenerate that:
- Re-runs only the source-mapping pass (no AI re-generation, no version bump) — matches each node's `source_l_reference` string against `document_sections.section_number` for that solicitation and fills `source_document_sections`.
- Avoids losing your current outline edits.

If you'd rather just regenerate, you can skip this and use the existing Regenerate button after the change ships.

## Files touched

- `supabase/functions/generate-outline/index.ts` — schema + persistence
- New migration — add `outline_nodes.source_document_sections jsonb default '[]'`
- New edge function `relink-outline-sources` (small, optional, for backfill)
- `src/features/outline/hooks/useProposalOutline.ts` — expose new field + relink mutation
- `src/pages/SolicitationOutline.tsx` — per-row "Sources" disclosure + deep links

## Out of scope

- Changing the outline structure or AI prompt logic
- Editing how requirements or section analyses are produced
- Any change to drafting / Phase 4 / Phase 5
