
# Solicitation AI Assistant

A scoped, conversational AI surface inside each solicitation that can answer questions across documents, analysis, risks/opportunities, requirements, strategic questions, client knowledge/AI Lens, capabilities, incumbents/teaming, prior solicitations, and reports. Threaded chats per solicitation are saved to Lovable Cloud. Available both as a Workspace dropdown page and a floating slide-over launcher on every solicitation tab.

## User-facing behavior

- New `AI Assistant` item appears in the Workspace dropdown alongside Writing Queue / Reports / Comparison / Activity, opening a full-page chat at `/solicitations/:id/assistant?thread=<id>`.
- Floating sparkle launcher pinned bottom-right on every solicitation page. Opens a side drawer hosting the same chat, scoped to the current solicitation. Drawer and full page share threads via the `?thread=` query param so reload restores state.
- Left rail: thread list (New chat, pinned, recent), search, rename, delete, pin, **Share link** (copies the deep URL — any teammate with solicitation access can open it).
- Composer with quick-prompt chips (system presets + user-saved + org-shared), **voice input** (mic button → live transcription), and **file attachments** (image / PDF / docx, drag-and-drop or paperclip).
- Assistant streams answers with inline citations to source records (document chunk, risk, requirement, etc.). Clicking a citation deep-links to the related tab/record.
- Empty state shows the agent's identity (custom logo, not `Sparkles`) and a "tailored to this solicitation" subtitle with a suggested-prompt grid.

## Data model (Lovable Cloud)

All tables RLS-scoped to users who already have access to the parent solicitation/org.

- `assistant_threads` — `id`, `solicitation_id`, `created_by`, `title`, `pinned`, `last_message_at`, timestamps.
- `assistant_messages` — `id`, `thread_id`, `role` (user/assistant/system), `parts` (jsonb of AI SDK `UIMessage` parts incl. tool calls, citations, attachments), `created_at`.
- `assistant_presets` — `id`, `scope` (`system` | `user` | `org`), `owner_id?`, `org_id?`, `label`, `prompt`, `icon`, `sort_order`, timestamps. Seeded with system defaults.
- `assistant_attachments` — `id`, `message_id`, `storage_path`, `file_name`, `mime_type`, `size_bytes`, `created_by`. Files live in a new private Storage bucket `assistant-uploads/`.

Reuses existing `client_knowledge_chunks` (pgvector) and adds per-solicitation document chunk search over `documents` / `document_sections`. Embeddings continue through `_shared/embeddings.ts` (`google/gemini-embedding-001`).

## Backend

### `solicitation-assistant` (streaming chat)

AI SDK + Lovable AI Gateway, `google/gemini-2.5-pro` (flash fallback). The function:

1. Authenticates, verifies access to `solicitation_id` and `thread_id`.
2. Loads conversation history from `assistant_messages`.
3. Calls `streamText` with a strict system prompt ("scoped to this solicitation; cite sources; refuse out-of-scope"), an injected context card (title, agency, due date, phase, client name, counts), and a tool set:
   - `search_solicitation_documents(query, k)` — pgvector over this solicitation's chunks.
   - `search_client_knowledge(query, k)` — pgvector over the linked client's KB.
   - `get_solicitation_overview()` — solicitation row + analysis summary.
   - `list_risks_opportunities()` — risks + opportunities with mitigations/actions.
   - `list_requirements(filter?)` — requirement_items / section_analyses.
   - `list_strategic_questions(filter?)` — strategic_questions + answers.
   - `get_client_profile_and_lens()` — client_profiles + active lens preset.
   - `list_capability_gaps()` — capability_gaps for the client.
   - `list_teaming_and_incumbents()` — teaming partners + prior_solicitations.
   - `list_reports()` — executive_reports content.
4. Accepts multimodal `UIMessage` parts (text + image_url + file) per ai-multimodal-input guide; sends them straight through to the gateway.
5. `stopWhen: stepCountIs(50)`, streams via `toUIMessageStreamResponse({ originalMessages, onFinish })`. `onFinish` persists the assistant `UIMessage` (with citations) to `assistant_messages`.
6. Surfaces 429 / 402 errors cleanly.

### `assistant-transcribe` (voice input)

Edge function that accepts an audio blob, calls ElevenLabs Scribe (`scribe_v2`) via the standard `elevenlabs` connector (requires linking), and returns `{ text }`. If the connector is not linked, returns 412 and the UI shows a "connect ElevenLabs to enable voice" prompt. (Realtime streaming transcription is a follow-up.)

### Storage

New private bucket `assistant-uploads` with RLS policies allowing read/write only to users with access to the owning thread's solicitation. Uploads go directly from the browser with signed URLs; the server records metadata in `assistant_attachments` and attaches a `file` part to the user message before streaming.

## Frontend

Install AI Elements: `conversation`, `message`, `prompt-input`, `shimmer`, `tool`. Use `MessageResponse` for streamed markdown; tool calls render collapsed.

New files:

- `src/pages/SolicitationAssistant.tsx` — full-page route view (thread sidebar + chat pane).
- `src/features/assistant/components/AssistantChat.tsx` — `useChat` with `DefaultChatTransport` pointing at the edge function URL; remounts on `threadId`. Owns composer with voice + attachments.
- `src/features/assistant/components/AssistantDrawer.tsx` — Sheet wrapper hosting `AssistantChat`.
- `src/features/assistant/components/AssistantLauncher.tsx` — floating button mounted once in `SolicitationDetail`.
- `src/features/assistant/components/ThreadList.tsx` — list with rename/pin/delete/**share link** actions.
- `src/features/assistant/components/PresetChips.tsx` — renders system + user + org presets; "Save current prompt" action.
- `src/features/assistant/components/MessageCitations.tsx`, `AttachmentChip.tsx`, `VoiceRecordButton.tsx`.
- `src/features/assistant/hooks/useAssistantThreads.ts`, `useAssistantPresets.ts`, `useAssistantTranscribe.ts`, `useAssistantUpload.ts`.

`SolicitationDetail.tsx` changes:
- Add `"assistant"` to `WorkspaceKey` and `WORKSPACE_LABELS`.
- Add `<DropdownMenuItem>` for AI Assistant in `WorkspaceNavMenu`.
- Render `<SolicitationAssistant>` when `tab === "assistant"`.
- Mount `<AssistantLauncher solicitationId={s.id} />` once at page bottom so it persists across tabs.

### Org-wide preset admin UI

New Settings sub-tab `Settings → AI Assistant Presets` (admin/owner only) with CRUD on `assistant_presets` rows where `scope = 'org'`. End users only see system + their own + org presets in the chip bar. (Same UI exposes a "Save as org preset" action from a user preset when the user is admin.)

### Sharing a thread

`Share` action on a thread row copies the URL `/solicitations/:id/assistant?thread=<id>`. Anyone with solicitation access opens directly into that thread; messages render read-only for users without write access on the solicitation. No invite emails or tokens — pure access-driven.

## Identity & visual

- Generate a domain-specific assistant logo (briefcase + spark, brand gold). No `Sparkles` icon as avatar.
- Assistant messages: no bubble background. User messages: `bg-primary text-primary-foreground`. Attachments render as compact chips with file-type icon.

## Out of scope for v1

- Cross-solicitation Q&A (assistant stays scoped).
- Realtime/streaming voice transcription (batch only in v1).
- Inline editing of records from inside the chat (read-only Q&A; existing tabs remain the write surface).

## Verification

After build, on solicitation `b4b67f93-...`:
- Workspace dropdown shows AI Assistant; floating launcher appears on all tabs.
- Create two threads; reload restores active thread from URL. Share-link copy opens same thread for another teammate.
- Ask "what are the top 3 unmitigated risks and our mitigation plan?" — answer cites risks; clicking citation jumps to Risks tab.
- Upload a PDF and ask a question about it; assistant references the uploaded file.
- Click mic, speak, see transcript inserted into composer; submit; answer streams.
- Save a custom preset; admin saves an org preset; both appear in chip bar for permitted users.
