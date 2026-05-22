## Force decimal numbering on the outline

The previous regeneration (v2, 79 nodes) was created after the prompt/post-process edit but the stored `section_number` values are still `I`, `I.1`, `II.2.3`, etc. So two things need to happen: rewrite the existing rows in place, and make the edge function's renumbering bulletproof so the next regenerate can't store Roman numerals again.

### 1. Rewrite the active outline in place (no regenerate needed)

Run a one-shot SQL migration against the active outline for solicitation `c98a2376-4947-46c0-b9ec-bcb7123f392e` (and any other outline whose `section_number` still contains non-decimal characters). For each affected outline:

- Walk `outline_nodes` ordered by `sort_order`.
- Infer depth from the current `section_number` by counting dot-separated segments after stripping Roman numerals and letters (e.g. `I` → depth 0, `I.1` → depth 1, `II.2.3` → depth 2, `II.2.3.1` → depth 3).
- Maintain a `[v, s, ss, sss]` counter stack and emit `"{v}.0"`, `"{v}.{s}"`, `"{v}.{s}.{ss}"`, `"{v}.{s}.{ss}.{sss}"`.
- `UPDATE outline_nodes SET section_number = ...` for each row.

Implemented as a DO-block migration so it's idempotent and only touches rows where `section_number ~ '[^0-9.]'`.

### 2. Harden `supabase/functions/generate-outline/index.ts`

The current post-process trusts the AI's `depth` field. If the AI returns inconsistent depths (or omits them for some nodes), the counters drift. Change to:

- **Always** infer depth from the AI's proposed `section_number` first (stripping Roman/letter chars), and only fall back to `n.depth` when the section_number is missing/empty.
- Clamp depth to `[0, 3]` and never let a child appear before its parent (if `d > 0` and `counters[0] === 0`, force `d = 0`).
- After computing the new `section_number`, also overwrite `n.section_number` before the row mapping so the insert can't accidentally use the AI's original string.
- Add a `console.log` of the first 5 renumbered nodes so we can confirm in edge function logs that the rewrite ran.

### 3. No UI or schema changes

`SolicitationOutline.tsx` already renders whatever is in `section_number` — no front-end work needed. No new columns.

### Files

- New migration (rewrite existing rows).
- `supabase/functions/generate-outline/index.ts` (tighter renumber + log).
