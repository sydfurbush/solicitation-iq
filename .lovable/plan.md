# Phase 6 — Photo Intake & Multimodal Support

Lets users attach photos (mobile camera or file) to assistant messages. The model sees the images alongside the text question and can answer about them. Uses the existing `assistant-attachments` storage bucket and `assistant_attachments` table (no schema change).

## New files

- `src/features/assistant/components/PhotoAttachmentButton.tsx` — Button next to the mic. On mobile uses `<input type="file" accept="image/*" capture="environment" multiple>` so iOS/Android surface a Camera / Photo Library chooser; on desktop opens a normal file picker. Validates type (jpeg/png/webp/heic) and size (≤8MB each, ≤4 per message).
- `src/features/assistant/components/AttachmentChips.tsx` — Row of small thumbnails (object-URL previews) shown above the textarea for staged-but-not-yet-sent photos, each with an X to remove.
- `src/features/assistant/components/MessageAttachments.tsx` — Renders the photos that belong to a past assistant_message (queried via `assistant_attachments.message_id`). Inline thumbnails open the original on click.
- `src/features/assistant/hooks/useAssistantAttachments.ts` — `useQuery` returning attachments grouped by `message_id` for the current thread, plus signed-URL resolver (cached, 5-min TTL).

## Edits

- `supabase/functions/_shared/aiClient.ts`
  - Extend `CallAiArgs` with optional `images?: Array<{ url: string }>`.
  - In `callLovable`, when `images.length > 0`, send the user turn as OpenAI content blocks: `[{ type: "text", text }, { type: "image_url", image_url: { url } }, ...]`. Anthropic path unchanged (not used by this function).
- `supabase/functions/solicitation-assistant/index.ts`
  - Accept `attachmentIds: string[]` in the request body (cap at 4).
  - Load matching rows from `assistant_attachments` scoped to `thread_id`, sign each `storage_path` for 5 minutes, and pass the URLs as `images` to `callAiTool`.
  - After inserting the user message, `UPDATE assistant_attachments SET message_id = ... WHERE id IN (...)` so future renders can link photos to the right message.
  - Add a short "## Attached photos" note to the user prompt listing each filename so the model knows they're real evidence.
- `src/features/assistant/hooks/useAssistantThreads.ts`
  - `useSendAssistantMessage` accepts `attachmentIds?: string[]` and forwards them in the function payload.
- `src/features/assistant/components/AssistantChat.tsx`
  - Local state `pendingPhotos: File[]`. On submit: upload each file to `assistant-attachments` bucket at `{user_id}/{thread_id}/{uuid}.{ext}`, insert an `assistant_attachments` row (kind='photo', message_id=null), then send the message with the resulting IDs. On error, surface a toast and keep the files staged.
  - Render `<AttachmentChips />` above the textarea and `<PhotoAttachmentButton />` next to the mic. Disabled while sending or recording.
  - In `MessageRow`, render `<MessageAttachments messageId={m.id} />` above the assistant/user text when that message has photos.

## Out of scope

- Photo OCR / extraction pipeline (the model already sees the pixels via multimodal).
- Drag-and-drop into the chat area.
- Editing or re-cropping photos client-side.
- Multimodal for the Anthropic provider (this function is configured to Lovable Gemini, which is multimodal).

## Validation

- On mobile (iOS Safari / Android Chrome), the button opens the camera or photo library; on desktop it opens a file picker.
- Sending a message with one photo of a SOW page produces an answer that references content visible in the photo, and `assistant_attachments.message_id` is populated for that user message.
- Photos appear inline above the user message after reload (signed URL refresh).
- Files larger than 8MB are rejected client-side with a toast; more than 4 per message are rejected.
