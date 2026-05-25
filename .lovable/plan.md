
# Exhibits & Attachments — Plan

## Problem

Proposals routinely include figures, tables, charts, org charts, resumes, past-performance write-ups, certifications, and appendix files that are produced outside the narrative drafting flow. Today the system has no first-class place for these:

- `documents` holds the *incoming* RFP/amendments, not outgoing proposal artifacts.
- `solicitation_teaming_attachments` is scoped to teaming agreements only.
- `proposal_drafts` only stores section markdown.
- `compile-proposal` assembles drafts into Word volumes but never reads any exhibit/attachment table.

So authors have nowhere to register an artifact, assign it to a section, track readiness, or have it inserted into the final compiled package.

## Goal

A per-solicitation **Exhibits & Attachments** library that:

1. Lets users register exhibits (with files or as placeholders), assign each to an outline section or to an appendix.
2. Tracks owner, due date, and status (placeholder → in_progress → ready → approved).
3. Surfaces a per-section panel inside the Drafting workspace with one-click placeholder insertion.
4. Drives the compiler to embed images inline, append section-level exhibits, and (optionally per solicitation) produce a separate Appendix `.docx` volume.

## UX

### New sub-step under Phase 4 Outline: "Exhibits"

Added to the Phase 4 dropdown next to Outline / Format / Compliance Matrix.

- **Roster table** columns: Label · Title · Kind · Assigned to (section / appendix) · Owner · Status · Due · File · Actions.
- **Filters:** by kind, by status, by section, "missing file", "unassigned".
- **"Add exhibit" drawer:**
  - Kind: figure | table | chart | exhibit | resume | past_performance | certification | appendix | other
  - Title, optional Label (auto-numbered if blank, e.g., "Figure 3-1")
  - Assignment: outline node picker **or** appendix code (e.g., "Appendix B — Resumes")
  - Placement: `inline` (at `{{exhibit:id}}` token), `end_of_section`, or `appendix`
  - Owner, due date, status, caption, description, notes
  - File upload (PNG/JPG/PDF/XLSX/DOCX/PPTX) — optional; placeholder allowed
- **Per-solicitation settings panel** (top of tab):
  - Toggle: "Compile a separate Appendix volume" (default off)
  - Default appendix volume name & filename pattern

### Drafting workspace integration

- Side panel "Exhibits for this section" in `DraftingWorkspace`:
  - Lists exhibits assigned to the current outline node.
  - "Insert placeholder" drops `{{exhibit:<id>}}` token (rendered as a styled callout in the editor preview).
  - Quick-add button opens the drawer prefilled with the current section.

### Phase 5 progress header

- New counters: Exhibits — N placeholder / N in_progress / N ready / N approved, plus a "missing files" warning chip.

## Data model

### Storage bucket

- `proposal-exhibits` (private). Path: `{org_id}/{solicitation_id}/{exhibit_id}/{filename}`.

### `proposal_exhibits` (new)

| column | type | notes |
|---|---|---|
| id | uuid pk | |
| solicitation_id | uuid not null | FK by id, RLS via `is_solicitation_member` |
| organization_id | uuid not null | |
| kind | enum `exhibit_kind` | figure, table, chart, exhibit, resume, past_performance, certification, appendix, other |
| label | text | optional manual label; otherwise compiler auto-numbers |
| title | text not null | |
| caption | text | |
| description | text | |
| outline_node_id | uuid null | null when placement = appendix |
| appendix_code | text null | e.g. "Appendix B" |
| placement | enum `exhibit_placement` | inline, end_of_section, appendix |
| sort_order | int default 0 | within section or appendix |
| file_path | text | nullable when placeholder |
| file_name | text | |
| file_type | text | |
| file_size | int | |
| preview_image_path | text | rendered PNG used for inline insertion of non-image files |
| status | enum `exhibit_status` | placeholder, in_progress, ready, approved |
| owner_user_id | uuid | |
| due_date | date | |
| notes | text | |
| created_at / updated_at / created_by | standard | |

RLS mirrors `documents`: org members with solicitation access can CRUD; client portal read-only when client has `full` access.

### `solicitations` (alter)

- `compile_appendix_volume` boolean default false
- `appendix_volume_name` text default 'Appendix'

## Compile pipeline changes (`compile-proposal`)

1. Load `proposal_exhibits` for the solicitation.
2. Per outline node during render:
   - Resolve `{{exhibit:<id>}}` tokens in markdown: insert image (or `preview_image_path` for non-images) with numbered caption; for appendix-placed exhibits, replace with "(see Appendix X.Y)".
   - After section body, append all `placement = end_of_section` exhibits in `sort_order`.
3. After all volumes, if `compile_appendix_volume` is true:
   - Emit a separate Appendix `.docx` grouping all `placement = appendix` exhibits by `appendix_code`, sorted; insert each file (image embedded, PDF/Office attached as cover-page + filename reference) with cover/divider page per group.
4. Auto-number `Figure N-M` and `Table N-M` per volume when `label` is blank.
5. Extend `pre_flight_report.issues`:
   - error: exhibit referenced by token but file missing and status ≠ placeholder
   - error: status = approved but no file
   - warn: unresolved `{{exhibit:…}}` token in any draft
   - warn: duplicate label
   - warn: exhibit assigned to deleted outline node
6. New `proposal_packages.kind = 'appendix'` row when appendix volume is produced.

## Files

### New

- `supabase/migrations/<ts>_proposal_exhibits.sql` — enums, table, storage bucket + policies, columns on `solicitations`.
- `supabase/functions/_shared/exhibits.ts` — load, token resolve, image/file embed helpers.
- `src/features/exhibits/hooks/useExhibits.ts` — list/create/update/delete/upload, signed-URL helper.
- `src/features/exhibits/components/ExhibitsTab.tsx` — roster, filters, settings panel.
- `src/features/exhibits/components/ExhibitDrawer.tsx` — add/edit drawer with upload.
- `src/features/exhibits/components/SectionExhibitsPanel.tsx` — drafting side panel + insert action.
- `src/features/exhibits/utils/exhibitNumbering.ts` — auto-label preview.

### Changed

- `src/pages/SolicitationDetail.tsx` — add "exhibits" entry to Phase 4 dropdown.
- `src/pages/SolicitationOutline.tsx` (or Phase 4 host) — render `ExhibitsTab` for step "exhibits".
- `src/features/drafting/components/DraftingWorkspace.tsx` — mount `SectionExhibitsPanel` and pass token-insert callback to `MarkdownEditor`.
- `src/features/drafting/components/MarkdownEditor.tsx` — expose insert-at-cursor for tokens; render `{{exhibit:…}}` callouts in preview.
- `src/features/drafting/components/Phase5ProgressHeader.tsx` — exhibit readiness counters.
- `supabase/functions/compile-proposal/index.ts` — wire token resolution, end-of-section appends, optional appendix volume, pre-flight checks.

## Out of scope (deferred)

- In-app chart authoring / data-driven figure generation.
- Versioning/diff of exhibit files (replace overwrites; history not tracked).
- AI-suggested exhibits or auto-caption generation.
- Cross-solicitation exhibit reuse library (e.g., shared resume bank).
- Watermarking, redaction, or compliance scanning of attached files.

## Acceptance criteria

- Phase 4 dropdown shows "Exhibits" and opens the new tab.
- A user can add a placeholder exhibit with no file, assign it to a section, and see it in the Drafting workspace side panel.
- "Insert placeholder" puts a `{{exhibit:<id>}}` token in the markdown that previews as a styled callout.
- Uploading an image to an exhibit and recompiling embeds it inline at the token with a numbered caption.
- Toggling "Compile Appendix volume" produces an additional `appendix.docx` package containing appendix-placed exhibits, grouped by `appendix_code`.
- Pre-flight report flags missing files for non-placeholder exhibits and unresolved tokens.
