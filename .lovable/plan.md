# Show scoring weight on every section card

## Approach
Keep the AI's existing **stated** `scoring_weight` (numeric % from Section M) and add an **AI-inferred importance score** (1–5) for every section. Display both, clearly labeled, so consultants always see a value.

## Schema change
Add to `section_analyses`:
- `importance_score` smallint (1–5, AI-inferred relative importance)
- `weight_source` text — `'stated'` when the source supplies a numeric weight, `'inferred'` otherwise, `null` when neither set

`scoring_weight` (existing numeric) stays as-is for stated weights.

## Edge function (`supabase/functions/analyze-sections/index.ts`)
Update the prompt and JSON schema to require for every section:
- `scoring_weight` — number or null (only when source explicitly states a point value or %)
- `importance_score` — integer 1–5 (always required; reflects the section's strategic weight to the proposal: evaluation factors → 5, PWS/SOW core scope → 4, instructions/admin → 2, boilerplate/SF forms → 1)
- `importance_rationale` — short string (≤140 chars) explaining the score

Insert logic sets `weight_source = scoring_weight ? 'stated' : 'inferred'`.

## UI (`src/pages/SolicitationDeepDive.tsx`)
Replace the current single conditional `Weight` badge with a small two-state badge group on every card header:
- If `scoring_weight` set → solid badge `Weight: {n}%` tagged "Stated" (phase-2 violet).
- Else → outline badge `Importance: {1–5}` tagged "AI" with a tooltip showing `importance_rationale`.
- Keep the existing `{n} flags` amber badge.

Also include the same fields in the report block emitted from this page so they appear in exports.

## Backfill
After deploy, the existing rows on solicitation `0d2c19f3-…` show no importance. The user can hit **Regenerate** on the Section Analysis tab to repopulate, or we trigger a one-time backfill via the same edge function — recommend the manual Regenerate path (no extra code).

## Files touched
- migration: add 2 columns on `section_analyses`
- `supabase/functions/analyze-sections/index.ts` — prompt, schema, insert payload
- `src/pages/SolicitationDeepDive.tsx` — render two-state badge + tooltip
- `src/integrations/supabase/types.ts` regenerates automatically
