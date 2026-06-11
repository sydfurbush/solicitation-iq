# Phase 4 — Knowledge Documents Panel

Wire the existing `client_knowledge_documents` corpus into the assistant chat so users can browse the client's knowledge base, pin relevant documents to the active thread, and have the assistant cite them.

## New files

- `src/features/assistant/components/KnowledgePanel.tsx` — Side sheet (Sheet from shadcn) opened from a `BookOpen` button in the chat header. Lists the active solicitation's client knowledge docs with status badges, tags, search box, and a pin/unpin toggle per row. Reuses the existing `useClientKnowledge` hook. Empty state links to the client's Knowledge tab.
- `src/features/assistant/components/PinnedKnowledgeChips.tsx` — Compact row of pinned docs shown under the persona/plain-mode header, with a click-to-unpin "×". Hidden when nothing is pinned.
- `src/features/assistant/hooks/usePinnedKnowledge.ts` — Reads/writes `assistant_threads.pinned_knowledge_ids` (uuid[]) via Supabase. Exposes `pinned`, `pin(id)`, `unpin(id)`, `clear()`.

## Database (single migration)

- Add `pinned_knowledge_ids uuid[] not null default '{}'` to `public.assistant_threads`. No RLS change (existing thread policies already cover reads/writes).

## Edits

- `src/features/assistant/hooks/useAssistantThreads.ts` — Extend `AssistantThread` with `pinned_knowledge_ids: string[]`. Extend `useUpdateThread` patch type. Forward `pinnedKnowledgeIds` in `useSendAssistantMessage` payload.
- `src/features/assistant/components/AssistantChat.tsx`
  - Add a `BookOpen` button next to Memory/Preferences that opens `KnowledgePanel`.
  - Render `PinnedKnowledgeChips` directly under the header strip when the thread has pinned docs.
  - Resolve the solicitation's `client_id` once (small `useQuery` on `solicitations`) and pass to the panel.
- `supabase/functions/solicitation-assistant/index.ts`
  - Accept `pinnedKnowledgeIds?: string[]` in the request body.
  - When present and non-empty, fetch up to 6 chunks across those docs: first try semantic match via `match_client_knowledge` (using the user's message as query embedding from the existing `generate-embedding` helper), then fall back to top-N chunks by `chunk_index` if no embeddings exist. Filter strictly to the pinned `document_id`s.
  - Inject a `## Pinned knowledge` section into the system prompt with `[doc-title › chunk N]` headers and trimmed chunk text (~800 chars each, total cap ~3.5k chars).
  - Append matching citations to the assistant message `citations` jsonb so `MessageRow` renders them as chips. Use shape `{ label, kind: "knowledge", document_id, chunk_id }`.
  - Audit log: include `pinned_knowledge_count` in `assistant_audit_log.metadata`.

## Out of scope

- Auto-suggesting docs (Phase 5). Phase 4 is manual pin/unpin only.
- Editing knowledge from the panel — panel is read-only + pin toggle. Note creation/upload stays on the client Knowledge tab.
- Risk Radar / Photo / History / Pinned-entity chips (Phases 5–7).

## Validation

- Opening the panel lists the correct client's docs and respects RLS.
- Pinning a doc persists across reload and shows a chip.
- Sending a message with a pinned doc that has ready embeddings yields an answer that quotes the doc and renders knowledge citation chips.
- Unpinning all docs returns the assistant to default behavior (no pinned-knowledge section).
- `assistant_audit_log` rows include `pinned_knowledge_count`.