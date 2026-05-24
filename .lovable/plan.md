
## Decisions locked in
- Batch runner: all three scopes — "Draft next undrafted", "Draft next 5", "Draft all undrafted in this volume"
- Edited status: any human save counts as Edited (no diff check)
- No forward-handoff transition copy — sections end cleanly

## 1. Prompt updates for flow & non-redundancy

**`supabase/functions/draft-section/index.ts`**
- Keep existing PRIOR SECTIONS block and NON-REPETITION RULES as-is.
- Add an UPCOMING SECTIONS block (titles only, no content) listing remaining siblings and the next top-level section, so the AI knows what NOT to encroach on.
- Add one rule to SYSTEM_PROMPT: "End each section cleanly on its own substantive last sentence. Do NOT write forward-pointing transitions, 'in the next section…' phrasing, or hand-off sentences. The next section will stand on its own."

**`supabase/functions/polish-section/index.ts`**
- Pass the same PRIOR SECTIONS summary the draft function builds (extract the builder into `_shared/priorSections.ts` so both functions use it), so polishes don't re-introduce content present elsewhere.
- Add the same "no forward transitions" rule.

## 2. Batch runner

In `DraftingWorkspace.tsx`, add a "Batch draft" dropdown next to the AI Draft button with three actions:
- **Draft next undrafted** — first node with no draft, in `sort_order`.
- **Draft next 5** — next 5 undrafted nodes in order.
- **Draft all undrafted in this volume** — every undrafted node whose `volume` matches the currently selected node.

Implementation: sequential loop over existing `useAiDraftSection` mutation (no new edge function). Each iteration sees the latest prior-section context because the previous call already wrote to the DB. Show a progress toast ("Drafting 3 of 7…"), stop on first error and surface it, disable the button while running. Cancellable via a "Stop" toast action.

## 3. Section status visibility (Option A + C)

**Status derivation (no schema change):**
- `none` — no row in `proposal_drafts` for that node
- `ai` — draft exists, `last_ai_action` set, no human save since (compare `updated_at` against the most recent `proposal_draft_versions.created_at` where `change_summary = 'Pre-AI-draft snapshot'`)
- `edited` — `updated_at` is after the most recent AI snapshot (any save counts)
- `polished` — `last_ai_action` ∈ {tighten, expand, rewrite_to_theme, compliance_check} and no human save since

**Option A — dots in the left rail.** Replace the `—` / `Nw` badge with: a small status dot (color-coded via semantic tokens) + word-count badge. Tooltip shows full status + last-touched timestamp.

**Option C — Phase-5 progress header.** Above the 3-column grid:
- Progress bar: drafted / total nodes
- Per-volume meter: words vs. (page_allocation × 350) budget, color shifts at >100%
- Status chips: counts for None / AI / Edited / Polished; click a chip to filter the left rail to that bucket

Color tokens to add (HSL) in `index.css` + `tailwind.config.ts`: `--status-none`, `--status-ai`, `--status-edited`, `--status-polished`.

## Files to change
1. `supabase/functions/_shared/priorSections.ts` (new) — shared prior-sections summary builder
2. `supabase/functions/draft-section/index.ts` — use shared builder, add UPCOMING block + no-transition rule
3. `supabase/functions/polish-section/index.ts` — add PRIOR SECTIONS block + no-transition rule
4. `src/features/drafting/utils/draftStatus.ts` (new) — pure helper deriving status from draft + versions
5. `src/features/drafting/hooks/useDraftVersions.ts` (new) — query latest version per draft for AI-snapshot timestamps
6. `src/features/drafting/components/DraftingWorkspace.tsx` — status dots in left rail, batch dropdown, progress header, status chip filter
7. `src/features/drafting/components/SectionStatusDot.tsx` (new) — small presentational component
8. `src/features/drafting/components/Phase5ProgressHeader.tsx` (new)
9. `src/index.css` + `tailwind.config.ts` — status color tokens

## Out of scope
- No DB migration (everything keys off existing `proposal_drafts.last_ai_action`, `updated_at`, and `proposal_draft_versions`)
- No diff-based "really changed" detection — any save = Edited as agreed
- No realtime presence on section rows
- No flat status-table view (Option B) — superseded by header + dots
