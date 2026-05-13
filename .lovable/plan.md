# Client Knowledge Library (RAG)

A per-client library of past proposal notes and source files. Snippets are auto-retrieved and cited inside every AI analysis (the same buildClientLens helper that already powers the Client Lens).

## What you get

- New **Knowledge** tab on each Client (next to AI Lens).
- Two ways to add content:
  - **Paste a note** (title + body, optional tags + source URL).
  - **Upload a file** (.txt and .md for v1; PDF/DOCX flagged as a follow-up).
- Background ingestion: the document is chunked (~800 chars, 100 overlap), embedded with Google `text-embedding-004` via Lovable AI Gateway, and stored.
- Status pills per document: `pending → embedding → ready` (or `failed` with error).
- During AI analysis, the top relevant snippets are pulled by semantic similarity, prepended to the prompt under a `## Client Knowledge` block, and surfaced as citations alongside the existing Client Lens block.
- A “Sources used” section appears on report viewer / section analyses showing which knowledge items shaped the output.

## How retrieval is wired

`buildClientLens` (already invoked from all 10 AI edge functions) is upgraded to:
1. Accept a `query` string (each caller passes the topic — e.g. solicitation title + agency for win themes, requirement text for gap analysis).
2. Embed the query, call a Postgres function `match_client_knowledge(client_id, embedding, k)` for top-K chunks, and return them as `citations` plus a markdown block.
3. Snapshot which knowledge doc IDs were retrieved into the existing report `lens` snapshot, so the badge tooltip can say “shaped by 4 knowledge sources”.

## Database

```text
client_knowledge_documents
  id, client_id, title, source_type (note|upload),
  file_path (nullable), mime_type, byte_size,
  raw_text (for pasted notes), tags text[], source_url,
  status (pending|embedding|ready|failed), error,
  chunk_count, created_by, created_at, updated_at

client_knowledge_chunks
  id, document_id, client_id, chunk_index,
  content, token_estimate,
  embedding vector(768), metadata jsonb,
  created_at
```

- Enable `vector` extension.
- IVFFlat index on `embedding` (cosine).
- RLS: org staff manage, client users read their own client’s docs.
- Storage bucket `client-knowledge` (private) + per-client folder policies.
- Postgres RPC `match_client_knowledge(p_client_id, p_query_embedding, p_match_count)` returning chunks + similarity.

## Edge functions

- `ingest-client-knowledge` — extracts text (paste = direct, .txt/.md = read from storage), chunks, embeds in batches of 64, writes chunks, updates status.
- `embed-query` — small helper (used inside `buildClientLens`) that calls the gateway’s `/v1/embeddings` endpoint with `google/text-embedding-004`.

## Files

- Migration: tables, RPC, bucket, RLS.
- `supabase/functions/ingest-client-knowledge/index.ts`
- `supabase/functions/_shared/embeddings.ts` (gateway helper, reused)
- `supabase/functions/_shared/clientLens.ts` — extend to do RAG retrieval and emit a `## Client Knowledge` block + citations.
- All 10 AI edge functions get an extra `query:` argument when calling `buildClientLens` (no behavior change if no knowledge exists).
- UI:
  - `src/features/clients/components/KnowledgeTab.tsx` (list, upload, paste-note dialog, status, delete).
  - `src/features/clients/hooks/useClientKnowledge.ts`.
  - Mount as a new tab on `ClientDetail`.
  - `LensSnapshotBadge` tooltip extended to show source count when present.

## Out of scope for this build

- PDF/DOCX text extraction (planned next; needs a parser or worker).
- Re-embedding on edit (we’ll re-ingest on demand instead).
- Cross-client knowledge sharing.

## Approval

This is a sizeable change touching the database, storage, every AI edge function, and adds a new tab. Confirm and I’ll ship it in one pass — starting with the migration so the types regenerate before the code lands.