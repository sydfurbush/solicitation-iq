## Goal

Eliminate duplicate questions on regenerate by always wiping prior AI-generated questions before a new generation run. Manual questions are preserved.

## Changes

### 1. `supabase/functions/generate-questions/index.ts`
- Remove the `regenerate` flag dependency for the delete step. When the request is **not** a `retryRunId` retry, perform a single up-front delete of all `is_ai_generated = true` rows for the solicitation **before** the first batch runs (instead of conditionally inside the batch loop).
- Keep the existing `didRegenDelete` guard so it only fires once per run.
- Retries (`retryRunId`) skip the delete and continue appending, as today.

### 2. `src/features/questions/components/GenerateQuestionsDialog.tsx`
- Remove the "Replace existing AI-generated questions" checkbox and the `hasExistingAi` warning Alert (no longer needed — replacement is now the default).
- Remove `regenerate` state and stop sending it in the mutation payload.

### 3. `src/features/questions/hooks/useStrategicQuestions.ts` (and `SolicitationQuestions.tsx`)
- Drop the now-unused `regenerate` argument from `useGenerateQuestions` and the `hasExistingAi` prop wiring (cosmetic cleanup).

## Behavior after change

- Clicking **Generate** always: deletes prior AI questions → runs all batches → inserts fresh set. No more accumulation/duplicates.
- Manually-added questions (`is_ai_generated = false`) are untouched.
- **Retry failed batches** still appends only — no destructive delete on retry.

## Out of scope

- No DB schema changes.
- No dedupe of existing duplicates already in the table — user can clean those up by clicking Generate once after this ships, or we can add a one-off cleanup if desired.
