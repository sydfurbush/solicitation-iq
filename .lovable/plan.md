## Answers to your questions

### 1. Why did the retry "run all sections from the beginning"?

The previous run recorded `failed_batches: 1` but `failed_doc_ids: []` and `cross_doc_failed: false` — the failure scope was never written. The retry path I added last round detects exactly this case ("unknown scope") and falls back to a **full re-run in append-only mode** as a safety net, which is what you just observed (a brand-new run with all 6 batches). It is *not* deleting your existing 122 questions — they're preserved — it just re-processes everything and appends.

The reason the scope was unknown for that older run: the failed batch was the **cross-document contradiction pass**, and the version of the edge function that produced that run didn't yet set `cross_doc_failed = true` on failure. Newer runs will set it correctly, so future retries will scope to "cross-doc pass only" instead of full re-runs.

### 2. What is the "cross-document contradiction pass" and why does it partial-fail?

It's the **6th/final batch** of every run. After per-document batches finish, one extra AI call is made with:
- the table-of-contents of *all* documents in the package,
- up to 800 extracted entities (KPIs, dates, dollar amounts, places of performance, staffing minimums) across all docs.

Its only job is to surface contradictions *between* two or more documents (PWS vs. Technical Exhibit, CLIN vs. PWS, etc.) — questions a single-doc pass can't see.

Why it failed here: with 11 documents and 800 entity rows, the prompt commonly approaches the 120K-char hard cap. The most likely cause is an AI-side timeout or a tool-call validation rejection (e.g., the model returning an oversized `questions` array that fails schema validation). It's not "your data is broken" — it's a fragility in that single big prompt.

### 3. Are some documents too large and need to be broken up further?

Yes — one document is the outlier. Sizes (chars):

| Document | Sections | Total chars |
|---|---|---|
| **Technical Exhibit G — Site Management Manual (SMM)** | 10 | **284,839** |
| Solicitation — W9124D26RA041 | 398 | 150,768 |
| PWS — Updated 8 May 26 | 302 | 75,025 |
| Technical Exhibit F — IIC Information | 1 | 9,466 |
| (others) | 1–17 | <8K each |

The per-batch budget is 70K chars and the SMM is **4× over** that. Today, "big" docs get their own batch but the body is then heavily truncated section-by-section (`PER_SECTION_HEAD=2400`, `PER_SECTION_TAIL=1200`). For the SMM that means the model only sees ~36K of its ~285K chars — the AI is silently missing most of that document. The Solicitation (151K) and PWS (75K) are similarly clipped but less severely.

Worse: SMM has only **10 sections averaging 28K chars each, with one section at 89K**. Section-level chunking is too coarse — when you truncate a 89K section to head+tail you lose the middle 80K verbatim.

### 4. Why does the dashboard tile show 70 but the list shows 122?

Pure cache-staleness bug, not data corruption. DB has exactly 122 questions.

- The "Questions" stat tile reads `s.questions_count` from the `useSolicitation` query (`["solicitation", id]`), which embeds `strategic_questions(id)` and counts the array.
- The "Strategic questions / 122 total" header reads from `useStrategicQuestions` (`["strategic-questions", id]`).
- After the edge function inserts new questions, only `["strategic-questions", …]` and `["latest-question-run", …]` are invalidated. **`["solicitation", id]` is never invalidated**, so the tile keeps showing the count from before the run (70). A hard refresh would update it.

---

## Recommendation — proposed fixes

### Fix A — Stop re-running everything when only the cross-doc pass failed (highest priority for your immediate retry pain)

In `supabase/functions/generate-questions/index.ts`:
- Already done for new runs: cross-doc failures now set `cross_doc_failed=true` so retries are scoped to just that pass.
- For "unknown scope" retries (old runs like this one), keep the current full-re-run fallback but make it explicit in the UI: change the Retry button label/subtext on those rows to "Retry run (full re-process — original failure scope unknown)" so it's not surprising. *Already partially in place; verify the label is showing.*

### Fix B — Make the cross-doc pass more robust

In the same edge function, in the cross-doc block (lines 431–496):
1. **Cap entity rows by document** — instead of `limit(800)` flat, take e.g. top 80 entities per document so one chatty doc can't crowd out others.
2. **Trim earlier and harder** — drop `context_snippet` length to 100 chars, cap TOCs to 50 entries per doc.
3. **Split into two cross-doc sub-passes when the prompt is large** (>80K chars): "numeric/timing contradictions" and "scope/location/staffing contradictions". Each gets its own AI call and counts as its own sub-batch in the run record.
4. **Add a soft retry once on AI failure** before marking the pass failed.

### Fix C — Sub-section chunking for oversized documents

In `buildDocBlock` / `packBatches`:
- When a single section exceeds e.g. 8K chars, split it into overlapping sub-chunks (~6K chars, 500-char overlap) and treat each sub-chunk as its own pseudo-section for both budgeting and prompt assembly. This preserves verbatim middle content for the SMM.
- Bump per-doc batches: when a doc's total cost > `PER_BATCH_BUDGET`, run it across multiple batches (e.g., "SMM batch 1 of 4: sections 1–3", "batch 2: section 4 part A", …) instead of one truncated pass. Each becomes its own batch in the run UI, so the user sees real progress and a single chunk failure is recoverable.
- Lower `PER_BATCH_BUDGET` from 70K to ~50K to give the model more headroom; the current 70K plus prompt + schema can crowd context windows on heavy docs.

### Fix D — Fix the 70 vs 122 dashboard mismatch

In `src/features/questions/hooks/useStrategicQuestions.ts`, after every successful insert/update/delete (including after the generation run finishes), also invalidate `["solicitation", solicitationId]`. Additionally, in `GenerateQuestionsDialog.tsx`, when the polled run transitions to a terminal status (`completed | partial | failed`), invalidate `["solicitation", solicitationId]` once so the StatCard re-fetches its embedded count.

### Out of scope (not changing)

- DB schema, prompts' strategic content, question categories.
- The append-only retry semantics (existing 122 questions are safe).
- No backfill of the old run's missing `failed_doc_ids` — that data was never recorded.

---

## Suggested order of implementation

1. **Fix D** (1-line cache invalidation — eliminates the most confusing visible bug immediately).
2. **Fix B** (cross-doc resilience — directly stops the recurring 1-batch-failed pattern you keep hitting).
3. **Fix C** (sub-section chunking — biggest quality lift; the SMM is currently under-analyzed).
4. **Fix A polish** (clearer Retry label for legacy "unknown scope" runs).

Want me to proceed with all four, or just 1+2 first to unblock you?
