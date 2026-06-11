# Phase 5 — Risk Radar & Auto-suggested Knowledge

Surfaces solicitation risks inline in the assistant and lets the assistant proactively suggest knowledge documents to pin based on the user's question. No new tables.

## New files

- `src/features/assistant/components/RiskRadar.tsx` — Collapsible panel rendered above the message list when there are open (non-mitigated) high/critical risks for the solicitation. Lists severity-coloured chips with title + truncated description and a "Discuss" button that submits a pre-filled prompt ("How should we mitigate: <risk title>?") into the chat. Closed by default in `compact` mode.
- `src/features/assistant/components/SuggestedKnowledgeBanner.tsx` — Lightweight banner shown under the header when the latest assistant message includes `suggested_knowledge` ref data. Each suggestion is a row: doc title + one-line "why", with a Pin button that calls `usePinnedKnowledge.pin`. Dismiss button hides for the session.
- `src/features/assistant/hooks/useSolicitationRisks.ts` — `useQuery` over `risks` filtered to open high/critical for the current solicitation, ordered by severity then created_at.

## Edits

- `src/features/assistant/hooks/useAssistantThreads.ts` — Extend `AssistantMessage` with optional `suggestions?: { knowledge?: Array<{ document_id: string; title: string; why: string }> }` read from the existing `citations` jsonb column (no schema change — stored under a separate key in the inserted row via the edge function using a new `suggestions` column? No: piggy-back on `citations` by adding entries with `kind: "suggested_knowledge"`).
- `src/features/assistant/components/AssistantChat.tsx`
  - Mount `<RiskRadar />` above the message list (only when messages exist or as a one-time intro when empty).
  - After each assistant turn, render `<SuggestedKnowledgeBanner />` based on the most recent assistant message's `kind: "suggested_knowledge"` citations.
  - Pass `risksOpenCount` into `StarterCards` query key so dynamic starters refresh when the radar count changes meaningfully (best-effort).
- `supabase/functions/solicitation-assistant/index.ts`
  - Extend `TOOL_SCHEMA` with optional `suggested_knowledge: Array<{ document_id, title, why }>`.
  - Pass a compact "Available knowledge documents" list (id + title + tags, capped to ~25 docs, scoped to the solicitation's client) into the system prompt so the model can pick relevant ones to suggest. Only emit suggestions when the user's question would benefit from a doc that is NOT already pinned.
  - Validate suggestions against the actual `client_knowledge_documents` rows (drop any unknown IDs); cap at 3. Persist them as citations with `kind: "suggested_knowledge"` so the frontend banner can read them without a schema change.

## Out of scope

- Photo / image attachments (Phase 6).
- History/transcript export, pinned-entity chips (Phase 7).
- Editing risks from the radar — radar is read-only with a "Discuss" shortcut.
- Auto-pinning suggested docs — user always confirms.

## Validation

- A solicitation with at least one open `high`/`critical` risk shows the Risk Radar in chat; clicking "Discuss" sends the prefilled prompt and the radar collapses.
- When the assistant believes a knowledge doc is relevant, the banner appears with up to 3 suggestions and "Pin" adds them to `pinned_knowledge_ids`.
- Suggestions never reference an unknown or already-pinned `document_id`.
- Already-pinned docs are excluded from suggestions for the next turn.