## Problem

The "Full Analysis" report failed with:
> AI response truncated by token limit (model=claude-sonnet-4-5, max_tokens=16384)

Claude Sonnet 4.5's max output is 16,384 tokens (8,192 default, 16k with the extended-output beta header). The report prompt is large enough that the model wants to emit more than 16k tokens of structured JSON, so any attempt at 16,384 will keep truncating. We need a model with a larger output ceiling, or we need to split the work.

## Options

**Option A — Switch to Google Gemini 2.5 Pro (recommended)**
- Output ceiling ~65k tokens via Lovable AI Gateway, with the 150s timeout now non-blocking thanks to the existing background-job architecture.
- One-line change in `supabase/functions/_shared/aiClient.ts` `MODEL_CONFIG["generate-report"]`.
- Set `maxTokens` to ~32,000 (2× current ceiling, well under Gemini's limit, leaves headroom).
- Pros: minimal change, large output, strong long-form quality, free under Lovable AI Gateway promo through Oct 13.
- Cons: different writing voice from Claude; structured-output reliability is good but not identical.

**Option B — Switch to OpenAI GPT-5**
- Large context + output, strong reasoning.
- Same one-line config change; set `maxTokens` ~24,000.
- Pros: high quality, reliable tool output.
- Cons: slower and more expensive than Gemini; same background-job path keeps timeouts manageable.

**Option C — Keep Claude Sonnet 4.5 but chunk the report**
- Generate the report section-by-section (exec summary → requirements → eval factors → risks → recommendations) and stitch results.
- Pros: keeps Claude's writing voice.
- Cons: largest code change (new orchestration in `generate-report/index.ts`), more total tokens/latency, risk of inconsistency across sections. Not worth it unless you specifically want Claude's voice.

## Recommendation

Go with **Option A** now. It is the smallest, safest change and directly addresses the truncation. If output quality is unsatisfactory afterward, fall back to Option B; only reach for Option C if both models disappoint.

## Plan

1. Edit `supabase/functions/_shared/aiClient.ts`:
   - Change `"generate-report"` entry to `{ provider: "lovable", model: "google/gemini-2.5-pro", maxTokens: 32000 }`.
2. No other code changes needed:
   - Background-job flow (`EdgeRuntime.waitUntil` + polling) already in place from prior turn.
   - `AIModelsTab` already lists `google/gemini-2.5-pro` so an org-level override via Settings → AI Models will continue to work; users can override per-org without code changes.
3. Verify by clicking **Generate report**; the card should appear with "Generating", then flip to completed once Gemini returns. Watch edge function logs for `finish=stop` and `tool_arg_chars` well under the new cap.

### Fallback if Gemini still truncates or errors

- Bump `maxTokens` further (Gemini 2.5 Pro supports up to ~65k output).
- If the response comes back empty (Gemini gateway no-op), the existing empty-response retry in `callLovable` will retry twice automatically.
- If quality regresses, switch the same line to `openai/gpt-5` with `maxTokens: 24000`.

## Files to change

- `supabase/functions/_shared/aiClient.ts` (1 line)
