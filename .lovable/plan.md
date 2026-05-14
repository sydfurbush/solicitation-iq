## Add edit ability to Knowledge Library documents

Add an Edit (pencil) action to each row in the Client Knowledge Library so users can update the title, body/content, tags, and source URL of an existing knowledge note. Saving triggers a re-embed so the AI uses the updated content.

### Scope
- Notes (`source_type = "note"`): full edit of title, body, tags, source URL.
- Uploads (`source_type = "upload"`): edit title and tags only (body comes from the uploaded file). Re-embed not needed when only metadata changes.

### Changes

**1. `src/features/clients/hooks/useClientKnowledge.ts`**
- Add `useUpdateKnowledgeNote(clientId)` mutation:
  - Updates `title`, `raw_text`, `tags`, `source_url`, `byte_size`, sets `status: "pending"`, clears `error`.
  - Invokes `ingest-client-knowledge` to re-chunk/re-embed (graceful degradation already in place from prior fix).
- Add `useUpdateKnowledgeMeta(clientId)` mutation for upload rows:
  - Updates only `title` and `tags`. No re-ingest.

**2. `src/features/clients/components/KnowledgeTab.tsx`**
- Add a Pencil icon button per row (between re-embed and delete).
- Reuse the existing Dialog: refactor it into an "Add/Edit" dialog driven by `editingDoc` state.
  - When `editingDoc` is set and is a note → prefill title/body/tags/source_url; submit calls update mutation.
  - When `editingDoc` is set and is an upload → show title + tags only (body field hidden, with note "Content comes from uploaded file").
  - When no `editingDoc` → behaves as today (create new note).
- Toast on save: "Note updated — re-embedding in background" (or "Tags updated" for uploads).

### Technical notes
- No DB migration needed — `client_knowledge_documents` already has all required columns and existing RLS covers update for org members.
- Re-ingest path already handles missing embeddings endpoint and falls back to keyword search.
- Keep existing taxonomy quick-pick tag chooser working in edit mode.

### Out of scope
- Replacing the file content of an upload (would require a re-upload flow).
- Version history / diff of edits.
