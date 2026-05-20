# Why your risks disappeared

When you clicked "Identify risks & opportunities" with existing items present, the function ran in **regenerate** mode. That path:

1. **Deleted** all AI-generated risks and opportunities for this solicitation up front.
2. Called the AI (currently overridden to `anthropic/claude-haiku-4-5` with `max_tokens=8192`).
3. The model hit the token ceiling mid-response (`stop_reason=max_tokens` in the logs), so the structured tool output came back truncated/empty.
4. The function happily inserted **0 rows** and returned `success: true`.

Net result: old AI risks gone, no new ones written. Database now shows 0 risks for this solicitation. Manual risks would have survived, but you had none.

## Fix

Three changes, smallest blast radius first:

### 1. Stop deleting before we know the AI succeeded (`identify-risks-opportunities/index.ts`)

Reorder regenerate so we only wipe the old AI rows **after** we have a non-empty parsed result. If the AI call fails or returns zero items, existing data stays intact.

```text
old flow:  delete AI rows -> call AI -> insert (maybe 0)
new flow:  call AI -> validate non-empty -> delete AI rows -> insert
```

Also treat an empty `risks` + empty `opportunities` response as an error (throw), so the UI shows a toast instead of silently nuking the list.

### 2. Surface truncated AI responses (`_shared/aiClient.ts`)

In the Anthropic branch, when `stop_reason === "max_tokens"` throw an `AiHttpError` instead of returning the partial tool input. Same idea for the Lovable branch when `finish_reason === "length"`. This prevents future "silent zero-row" regenerations across every function that uses this client.

### 3. Raise the token budget for this function

The current DB override (`claude-haiku-4-5`, 8192 tokens) is too tight for 5-12 risks + 5-12 opportunities with quotes and citations. Options:

- **A (recommended):** keep Haiku, bump `max_tokens` to 16000 via the AI Models settings tab.
- **B:** switch the override back to `google/gemini-2.5-pro` at 12000 tokens (the code default) — slower but roomier and matches the original tuning.

I will not change `ai_model_settings` from code; that's a user-owned setting. I'll flag it in the toast/error message instead.

## After the fix

You'll need to click "Identify risks & opportunities" once more to repopulate the list. With the new safeguards, if the AI runs out of room again you'll get an error toast and your existing risks will remain.

## Out of scope

- Restoring the previously-deleted AI risks (they weren't snapshotted).
- Changing the opportunities pipeline beyond the shared safeguards above.
