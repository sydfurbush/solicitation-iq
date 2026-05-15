## What happened to the missing 34 questions

The edge function log tells the whole story:

```
[generate-questions] synthesis: removed=34 merged=6 kept=35
```

The new **synthesis pass** in `supabase/functions/generate-questions/index.ts` (`runSynthesis`, lines 1035–1117) ran after generation, sent all 69 drafts to Gemini 2.5 Pro with `SYNTHESIS_SYSTEM_PROMPT`, and the model returned:

- `remove`: 34 IDs (questions it judged self-answering / boilerplate / wrong-citation / duplicate)
- `merge`: 6 groups (each kept one, deleted the others — counted in the 34)

The code then **hard-deleted** all 34 rows from `strategic_questions` (line 1107–1110). They are gone — not hidden, not soft-deleted, not logged. That's why you see 35 in the UI.

This is exactly what we built last turn, but two things are wrong in practice:

1. **49% deletion rate is too aggressive.** The prompt says "quality over volume" but gives the model no ceiling. With 69 drafts on a complex solicitation, removing half is almost certainly cutting good questions alongside the noise.
2. **Destructive with no audit trail.** You can't review what was cut or restore anything. You only know the count from the log.

## Plan — three changes, all in `supabase/functions/generate-questions/index.ts`

### 1. Make synthesis non-destructive (soft-hide instead of delete)

Instead of `DELETE`, mark suppressed questions with a flag so they're hidden from the default UI but auditable and restorable.

- Add a column `synthesis_status text` to `strategic_questions` via migration with values `null` (kept), `'removed'`, `'merged_into'`, plus `synthesis_reason text` and `synthesis_merged_into uuid` (FK to the keeper).
- In `runSynthesis`, replace the `.delete()` with an `.update({ synthesis_status, synthesis_reason, synthesis_merged_into })`.
- Update the questions list query (`useStrategicQuestions`) to filter `synthesis_status is null` by default.

### 2. Cap the synthesis cut rate

Add a hard ceiling in `runSynthesis` after parsing the LLM response:

```
const MAX_CUT_RATIO = 0.25; // never remove more than 25% of drafts
const cap = Math.floor(drafts.length * MAX_CUT_RATIO);
if (idsToDelete.size > cap) {
  // keep the LLM's first `cap` removals (highest-confidence), restore the rest
  const trimmed = new Set(Array.from(idsToDelete).slice(0, cap));
  idsToDelete.clear();
  trimmed.forEach((id) => idsToDelete.add(id));
}
```

Tighten the prompt too: change rule 5 to "consolidate clusters of **5 or more**" (was 3) and add an explicit "removing more than ~25% of drafts indicates over-cutting — be conservative."

### 3. Surface synthesis decisions in the UI

In `CleanupQuestionsButton` area (or a new "Synthesis review" button on the Questions page), show:

- count of questions hidden by synthesis
- a panel listing each with its `synthesis_reason` and a "Restore" action that nulls the flag

This turns synthesis from a black box into a reviewable step.

## What this gets you for the current run

After the migration + UI filter change, the 34 questions become viewable again. We add a one-shot script (or a Supabase SQL the user runs) to retroactively un-mark this run's deletions — but since they were *already deleted*, **the 34 from this specific run cannot be recovered**. Only future runs benefit. Worth flagging up front.

## Open question before I build

Pick one:

- **A. Full plan (1 + 2 + 3):** soft-delete + cap + review UI. ~1 migration, edits to `runSynthesis`, the questions hook, and a new review panel.
- **B. Minimal (just 2):** keep the destructive delete but cap at 25% and tighten the prompt. No schema change, no UI work. Fastest, but still no audit trail.
- **C. Disable synthesis entirely** until we redesign it. One-line: comment out the `synthesis` chunk enqueue at line 518.

I'd recommend **A**. Tell me which to proceed with.
