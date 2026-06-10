# Give the AI Assistant access to document content (Pass 1)

The assistant currently sees only structured tables (risks, opportunities, requirements, etc.) plus a list of document filenames — never the actual text inside the uploaded documents. The text already lives in `document_sections.content`, and a Postgres full-text RPC `search_document_content` already exists (used by the Documents search UI).

Pass 1 wires that retrieval into the assistant. No schema changes, no embeddings, no UI changes.

## Changes

**`supabase/functions/solicitation-assistant/index.ts`**

1. Add a `retrieveDocumentExcerpts(supa, solicitationId, userMessage)` helper:
   - Build 1–3 search queries from the user's message: the full message (trimmed) plus the top keyword tokens after stripping stopwords and short words.
   - For each query call `supa.rpc("search_document_content", { p_solicitation_id, p_search_term })`.
   - Merge results, dedupe by `section_id`, sort by `rank` desc, keep up to 8 sections, hard-cap combined text at ~12,000 chars.
   - Strip the `<mark>` tags from `snippet` before injecting.
   - Return both the formatted text block and a structured `documentCitations` array `{ document_id, section_id, page, label }`.

2. Inject a new `# Document excerpts` section into `contextToString`, each item prefixed with `[Doc: <file_name> §<section_title> p<page>]`. Place it before the Risks/Opportunities blocks so the model treats it as primary source material.

3. Tighten the system prompt: "Prefer answers grounded in `# Document excerpts`. Cite the exact `[Doc: …]` label you used. If the excerpts do not cover the question, say so explicitly and recommend which document to consult."

4. Persist the retrieved citations alongside the model-emitted ones when inserting the assistant message (merge `documentCitations` into the `citations` JSON array with `kind: "document"`).

5. Return the merged citations in the response payload so the existing chat UI rendering keeps working.

No client changes. No migrations. No new env vars.

## Out of scope (deferred to Pass 2)

- Embeddings / semantic retrieval (`document_chunks` table + `match_document_chunks` RPC).
- Hybrid keyword+vector ranking.
- Refactoring the assistant to a multi-step tool-calling loop where the model itself calls `search_documents`.
- Letting the assistant read `client_knowledge_chunks` (the client capability library).
- Any change to the chat UI, thread routing, or voice input.

I will validate by deploying the function and asking a document-grounded question in the existing assistant thread, then check `assistant_messages.citations` for document references.
