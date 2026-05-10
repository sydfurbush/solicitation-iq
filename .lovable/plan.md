## Problem

The edge function logs show: `only 0 questions generated for sol=…` and the function returned `success:true, count:0`. The AI call succeeded but came back without any items in `questions`. The deletion of prior AI-generated questions ran first, so the list ends up empty.

Two likely root causes:

1. **Prompt is too large.** With 11 documents × up to 30 sections × 3000 chars each, the user prompt can approach ~1M characters. Claude likely returns a `tool_use` whose `input` is `{}` (or only partial) and we silently treat that as "0 questions".
2. **Output token ceiling.** `max_tokens` is 8192 for `generate-questions`. If the model starts generating and the JSON is truncated mid‑array, the tool_use input may parse but end up empty/short. We currently don't inspect `stop_reason`.

A secondary issue: regenerate deletes existing questions **before** we know whether the new run will produce any. If the AI returns 0, the user is left with nothing.

## Plan

### 1. Make `generate-questions` resilient (`supabase/functions/generate-questions/index.ts`)
- **Delete after success only.** Move the `delete(...)` call to run only after `rows.length > 0` so a failed regeneration never wipes existing questions.
- **Cap input size aggressively** to keep us well under context limits:
  - Per document: at most 12 sections, each truncated to 1200 chars.
  - Global cap: stop adding section text once total prompt body exceeds ~120,000 chars.
  - Prefer sections with non-empty `section_title` and lower `sort_order` (already ordered).
- **Return a clear error when 0 questions come back** (HTTP 502 with message "AI returned no questions — try again or narrow focus areas/documents") instead of `success:true, count:0`.
- **Log `stop_reason`** from Anthropic response so we can diagnose truncation.

### 2. Bump output budget (`supabase/functions/_shared/aiClient.ts`)
- Raise `generate-questions` `maxTokens` from 8192 → 16384.

### 3. Surface failures in the UI (`src/features/questions/hooks/useStrategicQuestions.ts` + `GenerateQuestionsDialog.tsx`)
- The hook already throws on `data.error`; add a `toast.error(...)` in the dialog's `onError` so the user sees why nothing appeared (today the dialog likely just closes).
- On success show `toast.success("Generated N questions")`.

### 4. Verification
- Click Regenerate on the affected solicitation; confirm questions appear and the toast shows the count.
- Check edge function logs for `stop_reason` and the new section/char caps.
- Confirm that if AI still returns 0, prior questions remain intact and the user sees an error toast.

### Technical notes
- No DB schema changes.
- No frontend logic changes other than toasts.
- `aiClient.ts` change is a single number; the database `ai_model_settings` override still wins if set, so users can re-tune later.