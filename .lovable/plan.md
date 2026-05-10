## Goal

Route the 6 AI edge functions to Anthropic Claude (using a user-supplied `ANTHROPIC_API_KEY`), with a per-function model map so each one can be tuned later without code edits.

## Architecture

Create a shared helper `supabase/functions/_shared/aiClient.ts` exposing one function:

```ts
callAi({ functionName, system, user, jsonMode })
```

Behavior:
- Reads a per-function model from `MODEL_CONFIG` (defaults below). Each entry is `{ provider: "anthropic" | "lovable", model: string }`.
- If `provider === "anthropic"`: POST to `https://api.anthropic.com/v1/messages` with `x-api-key: ANTHROPIC_API_KEY`, `anthropic-version: 2023-06-01`, body `{ model, max_tokens, system, messages: [{role:"user",content:user}] }`. Extract `content[0].text`.
- If `provider === "lovable"`: keep current Lovable AI Gateway call (fallback / cheap path).
- For JSON-mode requests: prepend a strict "Return ONLY valid JSON" instruction to the system prompt and strip any leading ```json fences before parsing (Anthropic doesn't have a json_object response_format flag).
- Surface 401/402/429 with clear messages.

Default `MODEL_CONFIG`:

| Function | Provider | Model |
|---|---|---|
| `analyze-solicitation` | anthropic | `claude-sonnet-4-5` |
| `identify-risks-opportunities` | anthropic | `claude-sonnet-4-5` |
| `generate-questions` | anthropic | `claude-sonnet-4-5` |
| `generate-report` | anthropic | `claude-sonnet-4-5` |
| `compare-solicitations` | anthropic | `claude-sonnet-4-5` |
| `extract-entities` | anthropic | `claude-haiku-4-5` |

To change later: edit the `MODEL_CONFIG` object at the top of `_shared/aiClient.ts` (single source of truth). The map can also fall back to env overrides like `MODEL_<FUNCTION_NAME>` for zero-code changes if you ever want it.

## Edits per function

Replace the inline `fetch("https://ai.gateway.lovable.dev/...")` block in each of the 6 functions with a call to `callAi({ functionName: "<name>", system, user, jsonMode: true })`. No changes to prompts, schemas, parsing, or DB writes.

## Secret

Add `ANTHROPIC_API_KEY` via the secrets tool. User obtains it from https://console.anthropic.com/settings/keys.

## Notes / non-changes

- "Activities" are derived from DB triggers, not an AI call — no changes needed there.
- Lovable AI Gateway access is preserved; switching any function back is a one-line edit in `MODEL_CONFIG`.
- No frontend changes; hooks call the same edge functions.