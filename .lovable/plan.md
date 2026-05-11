## Goal
Make strategic-question generation reliable on large solicitations by batching the work into 2–3 documents per AI call, retrying transient failures, and inserting results incrementally.

## Why
The last failure was a 503 "connection termination" from the AI Gateway on a single 241K-char prompt covering 11 docs / 742 sections. The request was simply too big/long for one upstream call. Smaller, parallel-friendly calls are far more reliable and let partial progress survive a single bad batch.

## Changes

### 1. Backend — `supabase/functions/generate-questions/index.ts`
- **Batch by document group:** sort documents by section count and pack them into batches targeting ≤ 3 docs and ≤ ~70K prompt chars per batch.
- **Per-batch AI call:** each batch runs its own `callAiTool` with the same SYSTEM_PROMPT and SCHEMA, scoped to that batch's documents only.
- **Incremental insert:** insert each batch's rows immediately on success, so a later batch failure never loses earlier ones.
- **Regenerate semantics:** when `regenerate=true`, delete prior AI rows once — right before the first batch's successful insert — never before the AI call returns.
- **Cross-document pass:** after per-doc batches finish, run one final smaller call that sees only:
  - each document's TOC,
  - extracted KPIs / numbers / dates / locations / staffing snippets,
  - so contradiction / cross-reference questions are not lost to batching.
- **Per-batch logging:** `batch=i/N docs=[...] promptChars=... finish=... inserted=...` for easy diagnosis.
- **Progress tracking:** write a lightweight progress record (see §3) at start, after each batch, and at end.

### 2. Backend — `supabase/functions/_shared/aiClient.ts`
- Add automatic retry (up to 2 retries, exponential backoff ~2s/5s) for Lovable Gateway responses with status 503 or fetch errors that look like connection resets.
- Keep existing logging of `finish_reason`, `usage`, and `tool_arg_chars`.

### 3. Database — new `question_generation_runs` table
Tracks each generation run so the UI can show real progress instead of polling row counts blindly.
- Columns: `solicitation_id`, `status` (`running` | `completed` | `failed` | `partial`), `total_batches`, `completed_batches`, `inserted_count`, `error_message`, timestamps.
- RLS: same org scope as `strategic_questions`.

### 4. Frontend — `useStrategicQuestions.ts` + `GenerateQuestionsDialog.tsx`
- Replace the "poll row count for 4 minutes" hack with polling the new `question_generation_runs` row.
- Show progress: "Batch 3 of 5 complete · 42 questions added so far".
- Final toast distinguishes:
  - **Completed** — all batches succeeded.
  - **Partial** — some batches failed; show how many questions were still added.
  - **Failed** — no batches succeeded.

## Out of scope
- No changes to the question schema, categories, or UI rendering of questions.
- No model change — staying on `google/gemini-2.5-pro` @ 32K max tokens.

## Expected outcome
A full RFP package (10+ docs, 700+ sections) generates in 4–6 sequential AI calls instead of one giant call, each well under the gateway's stability threshold, with visible progress and no all-or-nothing failures.