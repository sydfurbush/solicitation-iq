## P4 — Switch `generate-questions` to a faster model

### Change

In `supabase/functions/_shared/aiClient.ts`, update the `generate-questions` entry in `MODEL_CONFIG`:

- **From:** `{ provider: "lovable", model: "google/gemini-2.5-pro", maxTokens: 32000 }`
- **To:** `{ provider: "lovable", model: "google/gemini-2.5-flash", maxTokens: 32000 }`

That's the only code change. Per-batch latency drops roughly 3–5x, which should bring the full 18-batch + cross-doc run inside the edge function CPU budget.

### Important caveat: DB override

Logs show the function is currently resolving from a DB override:
`[aiClient] resolved generate-questions -> ... source=db-override`

So a row in `ai_model_settings` is currently pinning it to `gemini-2.5-pro` and will **silently override the code change**. I'll also update that row (or delete it so the new code default takes over). I'll confirm via a quick `read_query` before/after.

### Optional, recommended add-on

Keep the **cross-document pass** on `gemini-2.5-pro` — it's a single call that benefits most from the stronger model and is small enough not to time out. This requires a tiny code tweak in `generate-questions/index.ts` to pass an explicit model override for that one call (a 1-line addition to `callAiTool` args, gated by `unit.kind === "cross"`). Say yes/no.

### Stuck run

P4 doesn't unstick run `7997dfe4…` — it's still sitting at `status='running'`. After deploying P4, simplest path is for you to hit **Generate Questions** again (it wipes prior AI questions and starts fresh). If you'd rather resume only the missing 14 batches via the existing Retry button, I'll also run the small SQL update from R1 to flip the run to `partial`. Tell me which.

### Files touched

- `supabase/functions/_shared/aiClient.ts` (1 line)
- `ai_model_settings` table (1 row update or delete)
- *(optional)* `supabase/functions/generate-questions/index.ts` (~3 lines for cross-doc model override)
