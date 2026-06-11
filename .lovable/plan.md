# Phase 2 — Personas, Slash Commands, Plain Mode, Dynamic Starters

Builds the conversational controls on top of the Phase 1 schema. No further DB changes in this phase.

## New files

- `src/features/assistant/components/PersonaSelector.tsx` — Dropdown over `PERSONAS` from `lib/personas.ts`. Writes `persona` to the active `assistant_threads` row via `useUpdateThread`. Shows short label + tooltip with description.
- `src/features/assistant/components/PlainModeToggle.tsx` — Compact toggle (icon + label "Plain"). Writes `plain_mode` to thread. Honors `assistant_preferences.plain_mode_default` as the default when a new thread is created.
- `src/features/assistant/components/SlashCommandPopover.tsx` — Popover anchored to the composer. Opens when the textarea value starts with `/`. Filters `SLASH_COMMANDS` by prefix, arrow-key navigation, Enter inserts/executes, Esc closes. Returns the chosen command + rest text so the chat can decide whether to send as-is or intercept client-side.
- `src/features/assistant/components/StarterCards.tsx` — Replaces the static preset grid in `EmptyState`. Renders 4 dynamic starters from the new edge function, with a refresh button and a graceful fallback to `assistant_presets` if generation fails.
- `supabase/functions/generate-assistant-starters/index.ts` — New function. Input: `{ solicitationId, persona, plainMode }`. Reads solicitation title/agency/risks/requirements summary via service role, asks the AI gateway for 4 short starter prompts tuned to persona + plain mode, returns `{ starters: string[] }`. CORS + JWT verify + audit log row (`route='starters'`).

## Edits

- `src/features/assistant/hooks/useAssistantThreads.ts`
  - Extend `AssistantThread` with `persona`, `plain_mode`, `pinned_client_id`, `pinned_solicitation_id`, `pinned_entity` (kept for later phases; only `persona` + `plain_mode` are used now).
  - Extend `useUpdateThread`'s `patch` type to include `persona` and `plain_mode`.
  - Extend `useSendAssistantMessage` payload to forward `persona`, `plainMode`, and parsed slash command (`{ handler, rest }` when present).
- `src/features/assistant/components/AssistantChat.tsx`
  - Header strip above the message list: `<PersonaSelector />`, `<PlainModeToggle />`.
  - Wire `SlashCommandPopover` to the textarea. When a `remember`/`forget`/`clear` command is chosen, intercept client-side and pass `{ handler, rest }` to the send mutation so the edge function records the directive without an LLM round-trip for `clear`. Other commands (`summarize`, `cite`, `risks`, `requirements`) are sent as normal user messages with the persona/mode applied.
  - Swap the static empty-state grid for `<StarterCards />` keyed by `(solicitationId, persona, plainMode)`.
  - Keep the existing preset chip row as a fallback when starters fail.
- `src/features/assistant/hooks/useAssistantStarters.ts` (new) — React Query hook calling `generate-assistant-starters` with a 5-minute stale time and `(solicitationId, persona, plainMode)` query key.
- `supabase/functions/solicitation-assistant/index.ts`
  - Accept `persona`, `plainMode`, and optional `slash` in the body.
  - Re-declare the persona catalog locally (Deno cannot import from `/src`) so `systemFragment` can be appended to the system prompt. Append a plain-English fragment when `plainMode` is true.
  - When `slash.handler === 'clear'`, do not call the model; just append a system message marker and return.
  - When `slash.handler` is `remember` or `forget`, still call the model (Phase 3 will wire actual memory writes) but include the directive verbatim. This keeps Phase 2 self-contained and Phase 3 only touches memory storage.
  - Persist `persona` and `plain_mode` onto the inserted user message metadata for audit (no schema change — uses existing `parts` jsonb where appropriate, or new keys on the audit log row).
  - Write an `assistant_audit_log` row per call (`route='chat'`, `persona`, `plain_mode`, `tokens_in/out`, `latency_ms`, `status`).
- `supabase/config.toml` — Register `generate-assistant-starters` (verify_jwt default).

## Out of scope for this phase

- Memory + preferences panels and their write paths (Phase 3).
- Knowledge / Risk Radar / Photo / History / Pinned chips (Phases 4–7).
- Copy-rich, regenerate, safety enforcement, rate-limit enforcement (Phase 8). Phase 2 only *records* audit rows; it does not yet block on rate limits.

## Validation

- Switching persona persists across reload and changes assistant tone within one message.
- Toggling Plain mode shortens responses and removes jargon.
- Typing `/` opens the popover; choosing `/risks` sends a normal message; `/clear-context` resolves without an LLM call.
- Starter cards regenerate when persona changes; refresh button forces a new set; fallback to presets if the edge function fails.
- A new row appears in `assistant_audit_log` per send with correct `persona` + `plain_mode`.
