## What happened

Two bugs explain both symptoms.

### 1. "Old items disappeared"

Earlier you ran the reset migration that deleted all AI questions for this solicitation. The slate was clean before this run. The 17 you see are the *only* ones the model produced — there were no prior items to merge with. (If `regenerate` was also checked, the function would have deleted AI rows again before inserting, but the outcome is the same: 17 total.)

### 2. "Many items missing vs. the 68-question reference doc"

Two real defects in the code path:

**Defect A — `max_tokens` is never sent to the Lovable AI Gateway.**
In `supabase/functions/_shared/aiClient.ts → callLovable()`, the request body to `ai.gateway.lovable.dev` includes `model`, `messages`, `tools`, `tool_choice` — but **not** `max_tokens`. So our configured `16000` (and the DB override) is silently ignored. The gateway falls back to its default output cap, which for Gemini 2.5 Pro is far below what 60–100 tool-call items need. The model hits the cap mid-array, the JSON tool-call gets truncated, and we either get a partial parse or only the items it managed to emit. 17 is consistent with a small default cap plus Gemini 2.5 Pro's "thinking" tokens eating into the budget.

There is also no `finish_reason` / usage logging on the Lovable path, so this failure is invisible — the function logs `inserted 17` and returns success.

**Defect B — per-section truncation drops the middle of long sections.**
`buildDocBlock()` keeps only the first 900 + last 400 chars of any section longer than ~1,340 chars. For a real PWS, almost every section is longer than that, so the model never sees the middle — and many of the reference doc's questions cite mid-section language (KPIs, staffing ratios, OCONUS rules, NDA timing, etc.).

Combined effect: input is partially blinded, output is hard-capped.

## Plan

### Step 1 — Send `max_tokens` to the Lovable Gateway and log finish reason

`supabase/functions/_shared/aiClient.ts → callLovable()`:
- Add `max_tokens: choice.maxTokens ?? 4096` to the request body.
- After parsing the response, `console.log` the `finish_reason`, `usage` (prompt/completion tokens), and tool-call argument length.
- If `finish_reason === "length"` (or `"max_tokens"`) and we still got a parseable tool call, log a clear warning so we know the array was truncated.

### Step 2 — Bump `generate-questions` token budget to fit 100+ items

Gemini 2.5 Pro supports up to 65,536 output tokens. A tool call with ~100 richly-populated question objects is roughly 35–55K output tokens. Set the cap with headroom:

- `MODEL_CONFIG["generate-questions"].maxTokens = 32000`
- Update the `ai_model_settings` row to `max_tokens = 32000` so the DB override matches.

(Per the project knowledge note: Gemini counts thinking tokens against this budget too, so leaving room above the expected output size is important.)

### Step 3 — Stop discarding the middle of long sections

In `buildDocBlock()`:
- Raise the per-section windows so the typical PWS section survives intact: head `2,400`, tail `1,200` (≈3.6K chars vs the current 1.3K).
- Raise `TOTAL_BUDGET` from `180_000` to `240_000` chars so the bigger windows aren't immediately starved. Gemini 2.5 Pro's 1M input context easily absorbs this; only the per-doc share math needs to keep up.
- Keep the existing per-doc proportional share — it already favors the PWS.

If after testing the prompt is still hitting `share` caps for the PWS, raise the per-doc minimum from `8_000` to `16_000`.

### Step 4 — Make the regenerate semantics safer

Today `regenerate=true` deletes AI rows *before* the model returns. If the model then returns 0 (or errors), you lose the prior set with nothing to replace it. Change the order:
- Run the model first.
- Only delete prior AI rows after we have a non-empty `rows` array, inside the same code block immediately before insert.

This means future failed runs no longer wipe the prior baseline.

### Step 5 — Verify

After deploy:
1. Click **Generate** with **Replace existing** checked.
2. Watch `generate-questions` logs for: prompt char count (should be ~220–240K), `finish_reason` from the gateway, `usage.completion_tokens`, and `inserted N questions`.
3. Expect N in the 60–110 range for this 11-doc draft RFP package.
4. If `finish_reason` is still `length`, raise `maxTokens` further (Gemini 2.5 Pro tops out at 65,536) and re-run.

### Files touched

- `supabase/functions/_shared/aiClient.ts` — add `max_tokens` and finish-reason logging on the Lovable path.
- `supabase/functions/generate-questions/index.ts` — bigger per-section windows, larger total budget, safer regenerate ordering.
- `MODEL_CONFIG["generate-questions"].maxTokens` → `32000`.
- `ai_model_settings` row update → `max_tokens = 32000`.

### Out of scope

- No schema changes.
- No frontend changes.
- No streaming work — bumping `max_tokens` and fixing the truncation should be enough; we'll only revisit streaming if Step 5 still under-produces.
