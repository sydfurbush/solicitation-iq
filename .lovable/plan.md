## Pre-Solicitation vs Final Solicitation — Plan

### 1. Data model (schema)

Migration on `solicitations`:
- Add `stage` enum (`pre_solicitation`, `draft_rfp`, `final`, `amendment`) — default `final` for backfill, but new records prompt user.
- Add `parent_solicitation_id uuid` self-reference (nullable).
- Add `stage_label text` (optional free text like "Amendment 0002") for display.
- Index on `(client_id, parent_solicitation_id)`.

New table `solicitation_snapshots`:
- `id`, `solicitation_id`, `snapshot_label` (e.g. "Pre-Sol baseline 2026-05-12"), `created_at`, `created_by`, `payload jsonb` (frozen copy of: solicitation row, requirement_items, risks, opportunities, capability_gaps, strategic_questions, section_analyses, executive_reports refs).
- RLS: org staff manage; staff + client (full access) can view.

New table `delta_actions` (the action queue):
- `id`, `solicitation_id` (the Final), `prior_solicitation_id`, `change_ref` (jsonb pointing to the diff entry), `entity_type` (`requirement`|`risk`|`question`|`opportunity`|`gap`|`outline`|`section`), `entity_id`, `recommended_action` (`re_extract`|`re_rate`|`archive`|`new`|`review`), `priority` (`high`|`medium`|`low`), `status` (`open`|`in_progress`|`done`|`dismissed`), `note`, `assigned_to`, timestamps.
- RLS mirrors `risks`.

### 2. Workflow — when the Final arrives

UI on the Pre-Sol's detail page (and from the global "+ New Solicitation" menu):
- Button **"Add Final Solicitation"** (visible when `stage = pre_solicitation`).
- Opens a wizard:
  1. Snapshot Pre-Sol (creates `solicitation_snapshots` row — auto-named, editable).
  2. Clone Pre-Sol metadata into a new solicitation with `stage = final`, `parent_solicitation_id` set, `status = active`. Pre-Sol stays active and editable per user's choice.
  3. Auto-create a `prior_solicitations` link from Final → Pre-Sol.
  4. Prompt user to upload Final docs (or import from SAM).
  5. After ingestion, kick off the standard analysis pipeline + the new delta pipeline (below).

### 3. Delta analysis pipeline

Edge function `compare-solicitation-stages` (extends existing comparison engine):
- Input: `final_solicitation_id`. Reads paired Pre-Sol via `parent_solicitation_id`.
- Runs the existing structural diff (sections, requirements, eval factors, scope, timeline, financials).
- **New: strategy impact pass.** For each detected change, the LLM scores impact and emits affected entity references:
  - For each Pre-Sol `strategic_question` → mark `answered` / `obsolete` / `still_relevant` / `newly_relevant`.
  - For each Pre-Sol `risk` → `severity_increased` / `decreased` / `mitigated_by_change` / `unchanged`.
  - For each `opportunity`, `capability_gap`, `requirement_item`, `outline_node`, win theme → similar tags.
- Writes results into `delta_actions` with a recommended_action per item.
- Stores a high-level `delta_summary` on `prior_solicitations.comparison_summary` (executive narrative).

### 4. Identification & display

- Solicitation list & detail header: show stage badge — "PRE-SOL" (amber), "FINAL" (green), "AMENDMENT" (blue).
- Breadcrumb on Final: "Client › Pre-Sol Title › Final" with link back to Pre-Sol.
- Sidebar widget on either record: "Linked stage" panel with the counterpart, snapshot list, and "Open Delta Analysis" button.

### 5. New screen: Delta Analysis (`/solicitations/:id/delta`)

Designed for both contractor (internal) and client viewing. Tabs:

1. **Overview** — executive summary, change counts by category, impact heatmap (high/med/low across requirements, risks, eval, scope, timeline, financials).
2. **Side-by-side diff** — reuse existing `ComparisonDiffViewer` with Pre-Sol as left, Final as right. Inline annotations.
3. **Requirements delta** — added / removed / modified table; click-through to RTM rows with auto-flagged status.
4. **Evaluation & scope** — weight changes, factor changes, page-limit changes, set-aside / NAICS changes.
5. **Strategy impact** — questions, risks, opportunities, gaps, win themes affected, with chips showing the tag (`obsolete`, `severity_increased`, etc.).
6. **Action queue** — filterable, assignable, status-trackable list from `delta_actions`. "Bulk apply recommendations" button (e.g., archive all obsolete questions in one click).
7. **Client view toggle** — when "Client view" is on, hide internal pricing/strategy detail and show only the executive summary, key changes, and a plain-language impact statement (matches access_level rules).

### 6. Client-facing Delta Report

New `executive_reports.report_type = 'delta_analysis'`:
- Generated via existing report pipeline.
- Sections: Cover, Executive Summary, What Changed (categorized), Impact on Strategy, Recommended Adjustments, Open Questions, Timeline Impact, Next Steps.
- Two render variants from one record: **Internal** (full) and **Client** (sanitized) — controlled by `client_accessible` flag and a server-side variant selector.
- PDF + DOCX export reuses existing exporter.

### 7. Out of scope (now)

- Auto-archiving Pre-Sol (user chose to keep it active).
- Diff-of-diffs across multiple amendments — the same model supports it (chain via `parent_solicitation_id`), but UI only shows one parent at a time in v1.
- Real-time co-editing of action queue.

### Technical notes

- Cloning uses a single SECURITY DEFINER Postgres function `clone_solicitation_for_stage(source_id, new_stage)` that copies solicitation row + optionally requirements/sections (configurable; default = metadata only since Final ingestion will regenerate).
- Snapshot is a pure JSONB blob — no FK cascade concerns when source rows mutate.
- Comparison runs are tracked in a new lightweight `delta_runs` table (status, batches, errors) modeled after `question_generation_runs` so we get retry semantics for free.
- All new RLS policies follow the existing `is_org_staff` / `current_client_id` pattern already in use.

### Build order

1. Schema migration (stage, parent_solicitation_id, snapshots, delta_actions, delta_runs).
2. Stage badges + "Add Final Solicitation" wizard + snapshot creation.
3. Clone function + auto-link to prior_solicitations.
4. Delta pipeline edge function + strategy impact prompts.
5. Delta Analysis screen (tabs 1–6).
6. Client view toggle + Delta report template.
7. Polish: bulk-apply actions, notifications to assigned users.
