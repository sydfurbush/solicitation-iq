# Phase 9 — Inline Actions on Assistant Replies

The assistant can now emit concrete "create this record" suggestions inline with its answer. Users apply them with one click and the row is inserted into `risks`, `opportunities`, or `requirement_items` for the current solicitation.

## New files

- `src/features/assistant/components/InlineActionButtons.tsx` — Renders pending suggested-action buttons below an assistant message. Click inserts the row via the Supabase client, invalidates the relevant query, toasts success, and marks the button as Added. Applied state is persisted per-message in `localStorage` (`assistant_applied_actions_v1`).

## Edits

- `supabase/functions/solicitation-assistant/index.ts`
  - Added `suggested_actions: [{ kind: "create_risk" | "create_opportunity" | "create_requirement", title, description?, severity? }]` to `TOOL_SCHEMA` (cap 3).
  - Added a system-prompt fragment instructing the model to emit suggested_actions only for NEW items not already in the provided context.
  - Validates returned actions (allowed kind, allowed severity, title trim/cap) and appends each as a `citations` entry of `kind: "suggested_action"`.
- `src/features/assistant/components/AssistantChat.tsx`
  - `MessageRow` now receives `solicitationId`, renders `<InlineActionButtons />` above the citation badge row, and filters `suggested_action` out of the visible badges (alongside `suggested_knowledge`).

## Validation

- Ask the assistant something like "What risks should I be tracking that aren't already logged?" — buttons such as "+ Create risk: …" appear under the reply. Clicking inserts a row into `risks` with `is_ai_generated=true`; the button switches to "Added" and stays disabled across reloads (localStorage-keyed).
- The "Add requirement" action writes `req_number` (`AI-XXXX`) + `shall_text` (the description) so the existing requirement_items schema is satisfied.
- Severity defaults to `medium` for risks when the model omits it. Unknown action kinds and missing titles are dropped server-side.
