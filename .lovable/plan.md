# Fix: AI Assistant should open to a blank new chat

## Problem
When opening the AI Assistant (no `?thread=` in the URL), `SolicitationAssistant.tsx` auto-selects the most recent existing thread, so the message window loads that thread's prior messages. The user expects a clean, empty chat ready for a new message.

## Change
In `src/pages/SolicitationAssistant.tsx`, replace the "auto-select first live thread, otherwise create" effect with: always create a new thread when no `?thread=` param is present, then navigate to it.

Specifically, in the effect at lines ~26–36:
- Remove the branch that selects `live[0]` when threads exist.
- Always call `create.mutateAsync({ solicitationId })` (guarded by `!create.isPending`) and `setThread(newThread.id)`.

Existing threads remain accessible via the thread list sidebar; selecting one still loads its history. Reloading a URL that already includes `?thread=<id>` continues to restore that thread (unchanged behavior).

## Files
- `src/pages/SolicitationAssistant.tsx` — simplify the auto-bootstrap effect to always create a fresh thread when none is in the URL.

No backend, schema, or other UI changes.
