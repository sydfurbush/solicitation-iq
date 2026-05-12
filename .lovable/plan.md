# Switch `extract-entities` to Gemini 2.5 Pro

## Why

Uploaded RFQ documents are failing with `"AI did not return structured tool call"` after text extraction. Root cause: `extract-entities` uses `google/gemini-2.5-flash`, which intermittently returns a chat reply instead of invoking the forced `save_entities` tool on dense RFQ content. Every other extraction step in the pipeline already uses `gemini-2.5-pro` and works reliably.

## Change

**File:** `supabase/functions/_shared/aiClient.ts`

Single edit on the `MODEL_CONFIG` map (line 19):

```ts
"extract-entities": { provider: "lovable", model: "google/gemini-2.5-pro", maxTokens: 16000 },
```

No other code, schema, prompt, or function changes.

## Recover the existing failed documents

After the function redeploys, click **Retry failed (1)** on the Documents tab of solicitation `7d1c6a0c…`. This re-runs `process-document` on the two failed RFQ rows (`9fbc5a2a…` and `fd1f1157…`), which then triggers `extract-entities` against Pro.

## Verification

1. Both failed RFQ documents flip Failed → Analyzed; tooltip shows no `processing_error`.
2. Documents header badge turns green: **"All 4 documents analyzed"**.
3. The "All documents ready" toast (built earlier) fires with the **Generate questions** action.
4. SQL check:
   ```sql
   select id, status, processing_error
   from documents
   where solicitation_id = '7d1c6a0c-2717-4e54-9076-e1a590c25b65';
   ```
   All five rows should be `analyzed`, `processing_error` null.

## Tradeoff acknowledged

Pro is ~5x slower and ~5x more expensive per call than Flash, but entity extraction runs once per document and reliability matters more than cost here. If volume becomes an issue later, we can revisit with a Flash-first / Pro-fallback pattern.
