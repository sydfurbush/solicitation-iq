## Phase 5 — Proposal Drafting & Submission

Builds on the existing Outline (Phase 3) + Win Themes (Phase 4) + Writing Queue. Today the Writing Queue tracks status (`not_started → drafting → pink → red → final`) but there is no drafting content, no review workflow, no compiled proposal, and no submission package. Phase 5 adds those.

Additive — does not change Phases 1–4.

### Scope

1. **Add `phase_5_drafting` to the phase model** — labels, colors, hub card, indicator, gating; advances from Phase 4 once themes are approved.

2. **Section Drafting Editor** (per outline node)
   - Rich-text editor (TipTap) bound to the outline node.
   - Left rail: linked Section L/M references, linked requirements (RTM), assigned win themes, gap callouts, page allocation vs. current word/page count.
   - Right rail: Client Knowledge retrieval panel — query the lens RAG with the section title/requirements, insert citations as `[K#]`.
   - **AI Draft button** — calls a new `draft-section` edge function. Inputs: section title, linked requirements, assigned themes, gaps, lens, knowledge excerpts. Output: first-pass draft in the editor, with inline `[Req-X]` and `[K#]` markers.
   - **AI Polish actions**: Tighten, Expand, Rewrite to Theme, Compliance-check (verifies every linked requirement has a "shall" response).
   - Autosave; per-section version history (snapshots on each save older than 5 min).

3. **Color-Team Review**
   - Inline comments on draft text (anchored ranges).
   - Review status per node: `pink_review`, `red_review`, `gold_review` (extends existing `writing_status` enum).
   - Reviewer assignment + due date.
   - "Reviewer dashboard" lists every section awaiting the current user's review.
   - Resolve / re-open comment threads; activity logged to `activity_log`.

4. **Compliance Matrix Live View**
   - Auto-generated from `requirement_items` × outline nodes × draft text.
   - Columns: Section L/M ref · Requirement (shall) · Volume/Section · Owner · Status · Page · "Found in draft?" (text-search heuristic).
   - Export to Word + Excel. Becomes the deliverable compliance matrix.

5. **Proposal Compiler** (`compile-proposal` edge function + client trigger)
   - Assembles all final sections by volume in outline order.
   - Front matter: cover letter (template + tokens), title page, transmittal letter, table of contents, list of figures/tables.
   - Body: section headings, draft content, inline figures, tables, requirement cross-references resolved.
   - Back matter: compliance matrix, résumés, past performance summaries, certifications & representations placeholder.
   - Page-formatting profile per buyer (font, size, margins, header/footer, page numbering, page-limit warnings per volume). Federal default + Utility default profiles.
   - Outputs: per-volume `.docx` + combined `.pdf`, written to the existing `reports` storage bucket under `proposals/{solicitation_id}/`.

6. **Submission Package**
   - "Submission Packager" assembles a `.zip` with: each volume `.docx` + `.pdf`, compliance matrix, redline vs. clean copies, transmittal letter, file-name conventions per buyer profile.
   - Pre-flight checklist UI: page limits, font/margin compliance, all requirements answered, all sections at "final", all comments resolved, signatures placed. Blocks packaging if any fail (with override + reason logged).
   - Stored in `reports` bucket; download link surfaced in the Phase 5 hub.

7. **Phase 5 Help doc** (`phase5.tsx`) following the existing primitives.

### Out of scope (future phases)

- Direct upload to buyer portals (SAM.gov, Ariba, PowerAdvocate, ePro, ISN, etc.).
- E-signature integration on certifications & reps.
- Pricing model / cost-volume builder (separate workstream).
- Real-time multi-cursor collaborative editing.

### Phasing

- **5a — Foundation**: phase enum + hub card + help; `proposal_drafts` table; section editor with autosave + version history; AI Draft button.
- **5b — Review & Compliance**: color-team statuses, inline comments, reviewer dashboard, compliance-matrix live view + export.
- **5c — Compile & Package**: `compile-proposal` edge function (Word + PDF), buyer formatting profiles (Federal + Utility), submission packager + pre-flight checklist.

### Technical Details

**New tables** (RLS by org via solicitation → client → organization):

- `proposal_drafts` — `id`, `outline_node_id` (unique), `solicitation_id`, `content_json` (TipTap JSON), `content_html`, `word_count`, `page_estimate`, `last_ai_action`, `updated_by`, timestamps.
- `proposal_draft_versions` — snapshot history (`draft_id`, `content_json`, `created_by`, `created_at`, `change_summary`).
- `proposal_draft_comments` — `id`, `draft_id`, `range_start`, `range_end`, `quoted_text`, `body`, `team` (`pink|red|gold`), `status` (`open|resolved`), `resolved_by`, threading via `parent_id`.
- `proposal_packages` — `id`, `solicitation_id`, `kind` (`volume_docx|volume_pdf|compliance_matrix|zip`), `volume`, `storage_path`, `byte_size`, `checksum`, `generated_by`, `pre_flight_pass`, `pre_flight_report` jsonb.
- `buyer_format_profiles` — `id`, `org_id`, `name`, `is_default`, `vertical` (`federal|utility`), `font`, `size_pt`, `margins_in`, `line_spacing`, `header_html`, `footer_html`, `page_number_format`, `volume_page_limits` jsonb, `file_name_pattern`, `notes`.

**Enum extension**: extend `writing_status` to include `pink_review`, `red_review`, `gold_review` (existing `pink_ready`/`red_ready`/`final` retained).

**Phase enum**: append `phase_5_drafting` to `PHASES` and `phase_type` DB enum; add color token `--phase-5`.

**New edge functions**:

- `draft-section` — Lovable AI Gateway, `google/gemini-3-flash-preview` default, `Output.object` with `{ content_html, citations[], requirement_coverage[] }`. Uses `buildClientLens({ topic: "draft", query: <section + requirements> })`.
- `polish-section` — single-purpose actions: tighten / expand / rewrite-to-theme / compliance-check.
- `compile-proposal` — pulls outline nodes + drafts + theme map + compliance matrix + buyer profile; builds `.docx` via `docx` npm package and `.pdf` via existing pdf generator; writes to `reports` bucket; records rows in `proposal_packages`.

**New client routes/components**:

- `/solicitations/:id/draft` — drafting workspace (volume tree + editor + lens panel).
- `/solicitations/:id/review` — reviewer dashboard.
- `/solicitations/:id/compile` — compile + pre-flight + package download.
- New components under `src/features/drafting/` (editor, comment thread, version history) and `src/features/compilation/` (pre-flight, packager).

**Storage**: `reports` bucket, paths `proposals/{solicitation_id}/{volume}/draft.docx`, `…/compiled.pdf`, `…/submission.zip`.

**Activity log**: every AI draft, polish, status change, comment, resolve, compile, and package event written via existing `log_activity`.

**Federal vs. Utility**: shipped `buyer_format_profiles` defaults — Federal (Times 12pt / 1" margins / volume tabs) and Utility (Arial 11pt / 0.75" margins / single-volume default). Profile selectable per solicitation.

```text
Phase 4 (Win Themes) → Phase 5 (Drafting & Submission)
                        │
                        ├── 5a Editor + AI Draft
                        ├── 5b Review + Compliance
                        └── 5c Compile + Package → submission.zip
```
