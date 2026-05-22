## Fix outline numbering (Roman → decimal)

The outline generator currently lets the AI pick `section_number` values, and it's producing Roman numerals (`I`, `I.1`, `II.2.1`) even though the prompt asks for decimal style. Fix it in two complementary ways so the displayed and exported outline always uses `1.0`, `1.1`, `1.2.1`, etc.

### Changes to `supabase/functions/generate-outline/index.ts`

1. **Tighten the prompt** — explicitly forbid Roman numerals and letter prefixes, and require decimal numbering rooted at each top-level volume (`1.0`, `1.1`, `1.1.2`, then `2.0`, `2.1`, …).

2. **Deterministic post-processing (authoritative)** — after the AI returns, walk `nodes` in order and re-derive `section_number` from `depth`:
   - Maintain a counter stack `[v, s, ss, sss]`.
   - `depth 0` → increment volume counter, emit `"{v}.0"`, reset deeper counters.
   - `depth 1` → increment section counter, emit `"{v}.{s}"`.
   - `depth 2` → `"{v}.{s}.{ss}"`.
   - `depth 3` → `"{v}.{s}.{ss}.{sss}"`.
   - If the AI ever omits `depth`, infer it from the dot-count of its proposed `section_number` (after stripping Roman numerals), defaulting to the current stack depth.

   This guarantees consistent numbering regardless of what the model returns, and is applied before the rows are inserted into `proposal_outlines` / `outline_nodes`.

3. No schema or UI changes — `ReportTypeSelector`, `SolicitationOutline.tsx`, and the export builders already just render whatever `section_number` is stored.

### Scope

- Only touches `supabase/functions/generate-outline/index.ts`.
- Existing outlines keep their stored numbers; clicking **Regenerate** rewrites them in decimal format.
- No DB migration required.
