# Fix: Analysis fails with "AI did not return structured tool call"

## Root cause

From edge logs for the failed job:
```
promptChars=148322
[aiClient] lovable model=google/gemini-2.5-pro finish=null
  prompt_tokens=0 completion_tokens=0 tool_arg_chars=0
ERROR job failed: AI did not return structured tool call
```

The Lovable AI gateway returned **HTTP 200 with an empty choices array** (zero tokens, no tool call, no finish_reason). This happens with Gemini 2.5 Pro on very large prompts — the model effectively no-ops. Our client currently treats this as fatal with no retry, so the job is marked `failed` and the UI shows "AI did not return structured tool call".

The 148k-char prompt is huge because the earlier per-doc character budget was reverted when we restored "pro-quality" analysis. 13 docs × 40 sections × 4000 chars = up to ~2M chars in theory; this run sent 148k, which Pro tolerates poorly.

## Fix (three layers, smallest viable change)

### 1. `supabase/functions/_shared/aiClient.ts` — handle empty Lovable responses
- Detect the "200 but empty" case (`!toolCall && completion_tokens === 0`) and treat it as a **transient** error: retry up to 3× with backoff, same as 503/504.
- If still empty after retries, throw a clearer `AiHttpError(502, "AI gateway returned empty response (model may be overloaded). Try again or switch model.")` so the UI shows actionable text instead of the cryptic tool-call message.

### 2. `supabase/functions/analyze-solicitation/index.ts` — cap prompt size, keep Pro
Re-introduce a **soft** character budget (much larger than the old aggressive 80k cap so quality is preserved):
- `TOTAL_CHAR_BUDGET = 180_000` across all docs (well under Pro's comfort zone, still ~10× a typical RFP).
- Per-doc budget = `max(8_000, floor(TOTAL / docCount))`.
- Per-section slice = `min(4000, remainingBudget)` — same 4000 ceiling we have today, just stops adding sections once the doc budget is spent instead of always taking 40.
- Keep 40-section cap and Gemini Pro model (no override).
- Log the final `promptChars` so we can see budget in action.

### 3. `analyze-solicitation/index.ts` — automatic fallback on persistent empty response
If `callAiTool` throws the new 502 "empty response" error, retry **once** with `modelOverride: { provider: "lovable", model: "google/gemini-2.5-flash", maxTokens: 16000 }` and tag the result in metadata as `model_used: "gemini-2.5-flash (fallback)"`. Flash handles large prompts more reliably and the user gets a result instead of a failure.

## What this does NOT change
- No DB schema changes.
- No frontend changes — UI already polls `analysis_jobs` and shows error/result.
- Background job pattern stays.
- Default model stays Gemini 2.5 Pro for normal-sized solicitations.

## Files

- edit `supabase/functions/_shared/aiClient.ts` — retry empty Lovable responses, clearer error.
- edit `supabase/functions/analyze-solicitation/index.ts` — soft prompt budget + Flash fallback on empty.
