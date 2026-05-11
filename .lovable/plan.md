## Switch `generate-questions` to Gemini 2.5 Pro @ 16K tokens

### Why
- Anthropic Sonnet 4.5 with `max_tokens=32000` non-streaming silently hangs (root cause of the last failure — no AI logs, just `shutdown` at ~200s).
- Gemini 2.5 Pro via the Lovable AI Gateway has no streaming requirement, runs ~2× faster, and costs ~3× less.
- 16K output tokens comfortably fits 100+ structured questions and lands well inside the edge-function background budget.

### Changes

**1. `supabase/functions/_shared/aiClient.ts`**
- Update `MODEL_CONFIG["generate-questions"]` to:
  - `provider: "lovable"`
  - `model: "google/gemini-2.5-pro"`
  - `maxTokens: 16000`

**2. `ai_model_settings` row (database migration)**
- Upsert the override row so the Settings UI shows the new values:
  - `function_name = 'generate-questions'`
  - `provider = 'lovable'`
  - `model = 'google/gemini-2.5-pro'`
  - `max_tokens = 16000`
- This overrides the in-code default at runtime (the override beats `MODEL_CONFIG`), so users can re-tune without redeploying.

**3. `supabase/functions/generate-questions/index.ts`**
- Lower `TOTAL_BUDGET` from `220_000` → `180_000` chars. Still huge; trims wall-clock by another ~15s and leaves headroom for the system prompt.
- No prompt or schema changes — categories, examples, and tool-call schema stay identical.

**4. Deployment**
- Deploy the updated `generate-questions` function so the change takes effect immediately.

### Verification
1. On the affected solicitation, click **Regenerate**.
2. Watch edge-function logs for:
   - `[aiClient] lovable …` (confirms gateway path)
   - `[generate-questions] inserted N questions` within ~90–120s
3. Confirm the toast shows the count and questions render in the UI.
4. If the gateway returns 402 (credits) or 429 (rate limit), the existing error handling in `aiClient.ts` surfaces a clear message to the dialog.

### Notes
- No schema changes to `strategic_questions`. New `drafting_error` / `contradiction` / `quantitative_gap` enum values added previously remain in use.
- No frontend changes. The 4-minute polling loop in `useStrategicQuestions.ts` is more than enough.
- Anthropic key stays configured for the other functions (`analyze-solicitation`, `identify-risks-opportunities`, `generate-report`, `compare-solicitations`).
