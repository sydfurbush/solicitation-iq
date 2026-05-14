Findings:
- The current solicitation has 252 AI-generated questions.
- Exact duplicate question text: 0 duplicate groups, 0 extra rows.
- Repeated source quotes: 29 groups / 35 extra rows sharing the same quote, so there are near-overlaps around the same issue even if the wording is not identical.
- There are 2 clearly bad/truncated short questions: “Is the ” and “The MOU mentions that ”.
- The latest run is stuck again: it reached batch 18/18 with 125 inserted, then stopped updating before the cross-document pass. Prior failed runs also timed out and retried by re-running the full unknown scope, which is why the total grew to 252.

Recommended implementation plan:

1. Add durable resumable run chunks
- Extend generation runs so each work unit is tracked as a resumable chunk instead of only a single long background job.
- Store chunk index, label, document ids, section slice metadata, status, inserted count, error, and timestamps.
- This lets the app retry only unfinished chunks instead of falling back to a full re-run.

2. Split execution into small callable sets
- Change `generate-questions` so the initial call creates a run and chunk plan, then processes only a small number of chunks per invocation, e.g. 2–4 chunks.
- Add a follow-up mode like `runId + continue` that processes the next pending chunks.
- The client can call continue until the run is complete, keeping each edge-function request under timeout limits.
- Keep the cross-document contradiction pass on Gemini 2.5 Pro, but make it its own chunk after all document chunks complete.

3. Prevent duplicate and low-quality inserts
- Add application-level dedupe before insert using normalized question text.
- Also dedupe against existing questions for the same solicitation so retries do not append the same issue again.
- Skip obviously malformed output such as question text shorter than a safe threshold or not ending as a usable question/request.
- Prefer `upsert`/ignore-duplicates if we add a database uniqueness constraint; otherwise keep this as function-level dedupe to avoid disrupting manual edits.

4. Add a cleanup/preview control for the current 252 questions
- Provide a safe cleanup action that removes exact duplicates if any appear later, removes malformed truncated questions, and optionally flags near-overlaps by shared source quote for review rather than deleting them automatically.
- Keep the run timeline/report so users can see which chunk failed and preview the failure.

5. Improve retry behavior
- For stuck runs, mark only unfinished chunks as failed/pending.
- Retry resumes from the next unfinished chunk, not from the beginning.
- If the cross-document pass fails, retry only that pass.

Technical notes:
- This likely needs a database migration for a `question_generation_run_chunks` table with RLS tied to the parent solicitation membership.
- Frontend changes will update the generation hook to loop through `continue` calls and report chunk-level progress.
- Existing tables remain intact; current questions are not deleted unless we add an explicit cleanup action and you choose to run it.