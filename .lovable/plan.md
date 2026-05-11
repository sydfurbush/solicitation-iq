# Fix: Citations missing in PDF and Word

## Root cause
Both renderers (`pdfGenerator.ts`, `wordGenerator.ts`) already render a **Source Citations** section — but only when `report.citations.length > 0`. The current edge function (`supabase/functions/generate-report/index.ts`) never instructs the AI to populate the top-level `citations` array, and it ignores the user's `options.includeCitations` toggle. The model only emits inline `[Doc §Section p.X]` strings inside prose, so `citations` comes back empty and the section is skipped.

Toggling "Include source citations" and "Include recommendations" in the dialog has no effect today — the flags are passed in the payload but never read by the prompt.

## Changes (edge function only — renderers already correct)

**File: `supabase/functions/generate-report/index.ts`**

1. **Honor `options.includeCitations`** — inject explicit instruction into the system prompt at request time:
   - When `true` (default): require `citations[]` to contain every source referenced inline, with stable IDs `C1, C2, …` and matching `[C1]` markers in section text. Minimum 3 citations when supporting documents exist.
   - When `false`: instruct the model to omit inline citation markers and return `citations: []`.

2. **Honor `options.includeRecommendations`** — when `false`, drop the "Recommendation" and "Next Steps" sections from the executive summary contract; when `true` (default), keep current behavior.

3. **Tighten the citation contract in `PROMPTS.executive_summary`** — change "Cite inline as [Doc §Section p.X]" to require `[C#]` markers tied to entries in `citations[]`, populated from the DOCUMENTS / RISKS / OPPORTUNITIES / QUESTIONS context already gathered (each row carries `source_citation` / `source_quote`).

4. **Defensive backfill** — after AI returns, if `options.includeCitations !== false` and `parsed.citations` is empty but `ctx.risks/opportunities/questions` have `source_citation` values, synthesize citation entries from those rows so the section is never blank.

## Out of scope
- No renderer changes (PDF/Word citation blocks already work — verified in `pdfGenerator.ts:drawCitations` and `wordGenerator.ts` lines 293-305).
- No UI changes to the options dialog.
- Existing reports won't update — user clicks **Generate report** again to refresh.

## Verification
1. Generate a new Executive Summary with both toggles ON → confirm "SOURCE CITATIONS" section appears at end of PDF and DOCX with `[C1] Document §X p.Y` entries.
2. Generate again with "Include source citations" OFF → confirm section is absent and inline `[C#]` markers don't appear.
3. Generate with "Include recommendations" OFF → confirm Recommendation + Next Steps sections are omitted.
