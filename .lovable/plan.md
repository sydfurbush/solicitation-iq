# Plan: Track AI Assistant tokens, cost, and model per Solicitation

## Problem
The Assistant Analytics panel shows Tokens = 0 because the `assistant_audit_log` table has `tokens_in` / `tokens_out` columns but nothing ever writes to them. The shared `callAiTool` helper does not return token usage, and `solicitation-assistant` only logs `status` and `latency_ms`. There is also no per-solicitation view — analytics is org-wide and not scoped to a single solicitation's lifetime.

## Goal
For each solicitation, regardless of which user makes the call, persist and display:
1. Total tokens used (input + output).
2. Estimated USD cost.
3. The AI model(s) used.

## Changes

### 1. Capture usage and model from the AI client
`supabase/functions/_shared/aiClient.ts`
- Add `callAiToolWithUsage(args)` returning `{ output, usage: { tokensIn, tokensOut }, model, provider }` without breaking existing callers.
  - Lovable path: read `json.usage.prompt_tokens` / `json.usage.completion_tokens` (already logged today).
  - Anthropic path: read `json.usage.input_tokens` / `json.usage.output_tokens`.
- `callAiTool` becomes a thin wrapper that returns only `output`, so other functions keep working unchanged.

### 2. Persist tokens + model in the assistant audit log
`supabase/functions/solicitation-assistant/index.ts`
- Replace the single `callAiTool` call with `callAiToolWithUsage`.
- On success, insert `tokens_in`, `tokens_out`, and `model` into the `assistant_audit_log` row (those columns already exist).
- Error path stays unchanged (still records `status="error"` with no usage).

### 3. Cost estimation
`src/features/assistant/lib/aiCost.ts` (new)
- Small lookup table mapping known model ids to `{ inputPer1M, outputPer1M }` USD prices for the models actually used by `solicitation-assistant` and likely future swaps (Gemini 2.5 Pro/Flash/Flash-Lite, GPT-5/5-mini/5-nano, Claude Sonnet 4.5). Unknown models fall back to `0` with `unknownPricing: true` so the UI can flag them.
- Export `estimateCost({ model, tokensIn, tokensOut })` → `{ usd, unknownPricing }`.
- Pricing constants live in code (not DB) so they're easy to update via PR and stay server-free.

### 4. Per-solicitation analytics hook
`src/features/assistant/hooks/useAssistantAnalytics.ts`
- Accept optional `solicitationId`. When provided:
  - Drop the `days` time filter (lifetime view).
  - Add `.eq("solicitation_id", solicitationId)`.
  - Include `solicitation_id` and `model` in the select.
- Compute and return:
  - `totalTokensIn`, `totalTokensOut` (already present).
  - `estimatedCostUsd` (sum of per-row `estimateCost`).
  - `byModel`: `Array<{ model: string, requests: number, tokens: number, costUsd: number, unknownPricing: boolean }>` sorted by requests desc.
  - `hasUnknownPricing`: boolean for UI footnote.
- Existing org-wide behavior preserved when `solicitationId` is omitted.

### 5. Analytics UI updates
`src/features/assistant/components/AnalyticsDashboard.tsx`
- Accept optional `solicitationId` prop; pass through to the hook.
- When scoped to a solicitation:
  - Title: "Assistant analytics — this solicitation".
  - Description: "Token, cost, and model usage across all users for this solicitation."
  - Hide the "Window" selector (lifetime view).
- Add two new Stat tiles next to the existing Tokens tile:
  - **Estimated cost** — formatted `$X.XX` (or `<$0.01` for tiny totals), with a small "estimated" caption and an asterisk footnote when `hasUnknownPricing`.
  - **Models used** — count of distinct models, with the top model name as the subline.
- Add a new "By model" section listing each model with request count, total tokens, and estimated cost.

`src/features/assistant/components/AssistantAnalyticsButton.tsx`
- Forward the current `solicitationId` (already in the assistant context) into `AnalyticsDashboard`.

### 6. Permissions and schema
- No migration needed — `assistant_audit_log` already has `tokens_in`, `tokens_out`, `model`, `solicitation_id`, and policies scoped per-org. All users on the solicitation already share read access through the existing RLS.
- Cost is computed client-side from persisted tokens + model, so no extra columns.

## Out of scope
- Backfilling historical rows: tokens/cost for requests made before deploy stay at 0. The panel notes "since {first audited request}".
- Real-time pricing pulls from provider APIs — pricing table is maintained in code.
- Per-user breakdown of cost (still aggregated across all users for the solicitation, per request).

## Files
- `supabase/functions/_shared/aiClient.ts` — add `callAiToolWithUsage`, keep `callAiTool` wrapper.
- `supabase/functions/solicitation-assistant/index.ts` — switch to new helper, write `tokens_in`/`tokens_out`/`model` on success.
- `src/features/assistant/lib/aiCost.ts` — new pricing table + `estimateCost`.
- `src/features/assistant/hooks/useAssistantAnalytics.ts` — solicitation-scoped lifetime mode, cost + model aggregations.
- `src/features/assistant/components/AnalyticsDashboard.tsx` — accept `solicitationId`, render Cost and Models tiles + By-model section.
- `src/features/assistant/components/AssistantAnalyticsButton.tsx` — pass `solicitationId`.
