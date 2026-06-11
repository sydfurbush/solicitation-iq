# Phase 7 — Transcript Export & Pinned-Entity Chips

Two complementary features that round out the assistant: users can export a thread's transcript (download markdown or copy rich text), and pin specific risks / opportunities / requirements / documents to a thread so the assistant treats them as the focus of the conversation.

## New files

- `src/features/assistant/lib/exportTranscript.ts` — Pure helpers that turn a thread + messages array into markdown and HTML strings (front-matter with title/persona/plain-mode/generated time, role-labeled turns, citations summary, image attachment filenames).
- `src/features/assistant/components/ExportThreadButton.tsx` — Header `DropdownMenu` with three actions: "Copy as rich text", "Copy as markdown", "Download .md".
- `src/features/assistant/components/PinnedEntityChips.tsx` — Renders the thread's pinned entities (risks, opps, requirements, documents) as clickable chips with X-to-remove. Empty state hidden.
- `src/features/assistant/components/PinEntityPopover.tsx` — "+ Focus" button that opens a popover with four small lists (risks / opportunities / requirements / documents) filtered by the solicitation. Clicking an item adds it to `thread.pinned_entity.entities` (capped at 5). Already-pinned items show a check mark.
- `src/features/assistant/hooks/usePinnedEntities.ts` — `usePinnedEntities(thread)` returns `{ entities, add, remove, isPinned, atLimit }` backed by `useUpdateThread` writing to `pinned_entity` jsonb.

## Edits

- `src/features/assistant/hooks/useAssistantThreads.ts`
  - Replace `pinned_entity: Record<string, unknown> | null` with `PinnedEntityPayload | null` where `PinnedEntityPayload = { entities: PinnedEntity[] }` and `PinnedEntity = { kind: "risk" | "opportunity" | "requirement" | "document"; id: string; label: string }`.
  - Allow `pinned_entity` in `useUpdateThread` patch.
- `src/features/assistant/components/AssistantChat.tsx`
  - Mount `<ExportThreadButton />` in the header next to the Knowledge/Memory/Preferences buttons.
  - Mount `<PinnedEntityChips />` and `<PinEntityPopover />` next to `<PinnedKnowledgeChips />` (one row).
- `supabase/functions/solicitation-assistant/index.ts`
  - When loading the thread, also select `pinned_entity`.
  - Resolve each pinned entity's title from its respective table (risks, opportunities, requirement_items, documents) and inject a `## Focus` block at the top of the user prompt: "The user has pinned these items as the focus of this conversation. Prefer to ground your answer in them; cite them by their existing labels." with a bulleted list.

## Out of scope

- PDF/DOCX export (markdown + rich-text covers Word/Outlook/Email paste-in).
- Sharing the export externally (the existing thread-share link already covers that).
- Pinning arbitrary text snippets (only existing structured records).
- Auto-pinning entities from the model.

## Validation

- "Download .md" produces a file named `assistant-thread-<slug>.md` containing the full transcript with citations.
- "Copy as rich text" pastes formatted markdown into Word / Gmail (headings, bullets preserved).
- Pinning a risk shows the chip in the header, and the next assistant turn quotes that risk's title in the response. Removing the chip removes it from the next prompt.
- Cap of 5 pinned entities is enforced both in the UI ("+" disabled when at limit) and in the edge function (slice).
