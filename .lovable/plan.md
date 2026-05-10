## Goal

Stop losing strategic questions that don't fit the current 5 categories (`clarification`, `strategic`, `scope_expansion`, `risk_concern`, `compliance`). Add a catch-all `other` category and tell the AI it's allowed (and expected) to use it for anything important that doesn't cleanly map.

## Why questions are missing today

In `supabase/functions/generate-questions/index.ts` the tool schema enforces:

```
category: enum ["clarification","strategic","scope_expansion","risk_concern","compliance"]
```

The AI is also told "distributed across all 5 categories" and capped at 8–15. So:
1. Anything that doesn't fit is dropped or reshaped to fit.
2. The model self-limits to ~15 even when more are warranted.
3. There's no safety net for valid questions that simply don't match a category.

## Plan

### 1. Add an `other` category (database)
- Migration: `ALTER TYPE question_category ADD VALUE 'other';`
- No data backfill needed.

### 2. Update the question-generation edge function
File: `supabase/functions/generate-questions/index.ts`
- Add `"other"` to the `category` enum in `SCHEMA`.
- Update `SYSTEM_PROMPT`:
  - Add: "If a strategically important question does not fit any of the first 5 categories, use `other` rather than discarding it. Do not force-fit."
  - Raise target to "10–25 questions" and remove the "distributed across all 5 categories" wording (replace with "cover whichever categories the solicitation actually warrants").
- Add a defensive coercion in the row-mapping step: if the model returns an unknown category string, coerce to `"other"` instead of letting the insert fail / row be lost. Log a warning.
- Optional safety: if `rows.length < 8`, log a warning so we can spot under-generation.

### 3. UI surfacing of the new category
File: `src/features/questions/utils/questionHelpers.ts`
- Add `"other"` to `CATEGORIES`.
- Add `CATEGORY_LABEL.other = "Other"`.
- Add a neutral color in `getCategoryColor` (e.g. slate/gray tokens consistent with the design system).

No other UI files need changes — `QuestionsMatrix`, `QuestionForm`, `QuestionCard`, filters, and CSV export all derive from `CATEGORIES` / `CATEGORY_LABEL`.

### 4. Manual-question entry already supports this
`CreateQuestionDialog` / `QuestionForm` build their dropdown from `CATEGORIES`, so once step 3 lands, users can also manually add an "Other" question.

## Out of scope
- No changes to risks, opportunities, or executive summary.
- No changes to recommendation enum or priority logic.
- No re-extraction of previously dropped questions (they were never persisted). User can click "Regenerate" on the affected solicitation after deploy to pick them up.

## Verification
1. Migration applies cleanly; `question_category` now has 6 values.
2. Deploy `generate-questions`.
3. On solicitation `0d2c19f3-2b93-40ab-a0fb-655ef8187bfa`, click Regenerate and confirm:
   - More questions than before (expect >15 if the doc warrants it).
   - At least some rows with `category = 'other'` if previously dropped questions exist.
   - No insert errors in edge function logs.
4. UI: "Other" appears as a filter chip and badge with a neutral color; CSV export includes it.
