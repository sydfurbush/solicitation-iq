## Problem

The Phase 1 analysis tab crashes with `a.map is not a function`. Looking at the database for the current solicitation (`1095001d-…`), `key_requirements` is stored as a JSON **string** instead of a JSON **array**. The frontend casts it to `AnalysisRequirement[]` and then calls `.map()`, which throws.

Root cause: in `analyze-solicitation/index.ts`, the AI tool occasionally returns `key_requirements` (and sometimes `evaluation_factors` / `risk_signals` / `opportunity_signals`) as a stringified JSON array rather than a real array. We persist whatever the model returned without normalizing.

## Fix

1. **`supabase/functions/analyze-solicitation/index.ts`** — add a small `toArray(v)` helper:
   - If `v` is an array → return as-is.
   - If `v` is a string → try `JSON.parse`; if the result is an array, use it; otherwise return `[]`.
   - Otherwise → `[]`.
   Apply it to `key_requirements`, `evaluation_factors`, `risk_signals`, `opportunity_signals`, and `incumbent_info.indicators` before persisting.

2. **`src/features/analysis/hooks/useAnalysis.ts`** — defensive parsing in `useSolicitationInsights` so any pre-existing bad rows render instead of crashing: same `toArray` coercion for `key_requirements` and `evaluation_factors`.

3. **Repair the current row** via a one-shot migration: for any solicitation where `jsonb_typeof(key_requirements) = 'string'` or `jsonb_typeof(evaluation_factors) = 'string'`, parse the inner string and rewrite the column as a real JSON array (fallback to `[]` on parse failure).

## Verification

- Re-open `/solicitations/1095001d-…?tab=phase-1&step=analysis` — page renders without the ErrorBoundary.
- Re-run analysis — DB shows `jsonb_typeof(key_requirements) = 'array'`.
- KeyRequirementsCard lists requirements; EvaluationFactorsCard renders.

## Out of scope

Changes to the AI prompt/schema or to other analysis cards. Only the persistence-layer normalization, the read-side guard, and the data repair.
