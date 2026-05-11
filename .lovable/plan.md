# Fix: All 127 strategic questions missing from questions_brief report

## Root cause

`supabase/functions/generate-report/index.ts`:

1. `gatherContext()` calls `.limit(40)` on `strategic_questions`, so the AI only ever receives 40 of the 127 questions.
2. Even if all 127 were passed in, the AI is asked to author Q&A prose for `questions_brief`. Output-token limits and model summarization mean items get dropped — the report should not depend on the model to faithfully echo 127 rows.

## Changes (edge function only)

### 1. Lift the questions cap, conditionally

In `gatherContext`, accept a `reportType` and:
- For `questions_brief`: fetch **all** questions for the solicitation (no `.limit`), with the columns needed to render each row (`category, recommendation, priority, question_text, question_rationale, source_citation, source_quote, is_submitted, agency_response`).
- For other report types: keep the existing `.limit(40)` (those reports only need a representative sample).

### 2. Deterministically build the `questions_brief` report from the DB

For `reportType === "questions_brief"`, **skip the AI authoring of question content** and build `sections[]` directly in the edge function:

- Group all questions by `recommendation`:
  - `ask` → "Submitted Questions"
  - `hold` → "Strategic Hold Questions"
  - `monitor` / `internal` / other → "Internal Discussion Items"
- Within each group, sort by `priority` desc, then `category`.
- Render each section as a single `bullets` block where each item is a one-line string:
  `Q{n}. [{category}] {question_text}` and, when present, append `\n   Rationale: {question_rationale}` and `\n   Source: {source_citation}`.
  - Bullets renderer in `pdfGenerator.ts` / `wordGenerator.ts` already supports plain strings.
- Add a small intro `paragraph` block per section with the count (e.g., "84 questions recommended for submission.").
- Title/subtitle: keep the existing default title behavior (`Strategic Questions Brief – {sol.title}`, subtitle = solicitation number).

The AI call is **not used** for this report type. This guarantees all 127 questions appear, in stable order, with no truncation.

### 3. Citations

- If `options.includeCitations !== false`, build `citations[]` from each question's `source_citation` (deduped, capped at 20 entries, IDs `C1..Cn`). Same shape as today's backfill path.
- If false, `citations = []`.

### 4. Out of scope

- No changes to `pdfGenerator.ts`, `wordGenerator.ts`, `ReportViewer.tsx`, or any UI.
- No schema/RLS changes.
- Other report types (`executive_summary`, `full_analysis`, etc.) are untouched.

## Verification

- Re-generate the questions brief on the current solicitation (`0d2c19f3-…`) and confirm all 127 questions appear in the PDF, Word, and in-app viewer, grouped by recommendation.
- Confirm executive_summary still renders correctly (40-question sample preserved for that path).
