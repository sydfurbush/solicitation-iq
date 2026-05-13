# Client AI Lens — Option C

Per-client AI context that every analysis edge function injects, plus a retrieval-augmented knowledge corpus the AI can cite from.

## Architecture

```
Layer 3: Solicitation context (per-doc)        ← exists
Layer 2: Client Lens
         ├─ Structured profile (NAICS, frameworks, voice…)
         └─ Knowledge corpus (past proposals, capability
            statements, lessons learned) → embeddings → RAG
Layer 1: Function system prompt                ← exists
```

Every AI edge function calls a shared `buildClientLens(clientId, { topic, query })` helper that returns a prompt block + the top-k retrieved knowledge snippets.

## Phase 1 — Structured Client Profile

**Schema (`client_profiles`, 1:1 with `clients`):**
- `naics_codes text[]`, `psc_codes text[]`, `set_asides text[]`
- `agencies_focus text[]`, `contract_vehicles text[]`
- `compliance_frameworks text[]` (HIPAA, CMMC L2, FedRAMP Mod, ITAR, SOC2, 508…)
- `discriminators jsonb` — list of `{title, evidence, proof_point}`
- `acronym_glossary jsonb` — `{ "C5ISR": "Command…", … }`
- `always_flag jsonb` — rules like "flag any LPTA evaluation" or "flag DBE subcontracting > 30%"
- `tone_voice text` (formal / consultative / technical), `reading_level int`
- `preset_key text` (Healthcare IT, DoD C5ISR, Civilian IT, Construction, R&D…)
- `version int`, `updated_by`, `updated_at`
- `solicitation_lens_overrides jsonb` on `solicitations` for per-opportunity overrides

**Presets:** seeded JSON in `src/features/clients/lib/lensPresets.ts` (5–7 verticals). "Apply preset" prefills, user edits.

**UI:**
- New "AI Lens" tab on `ClientDetail` page — sections: Identity & Codes, Compliance, Discriminators, Glossary, Voice & Rules, Preset.
- New `ClientLensBadge` component showing active lens name + version, rendered in `SolicitationDetail` header and on every AI-generated card (RTM rows, questions, risks, win themes, outline). Click opens drawer showing exactly which lens block was injected.
- Per-solicitation "Override lens" toggle in `SolicitationDetail`.

**RLS:** org staff manage; client portal users read-only on their own.

## Phase 2 — Knowledge Corpus (RAG)

**Schema:**
- `client_knowledge_documents` — `{ id, client_id, title, kind, file_path, file_size, status, uploaded_by, tags[] }`. `kind`: `prior_proposal | capability_statement | past_performance | lessons_learned | resume | white_paper | other`.
- `client_knowledge_chunks` — `{ id, document_id, client_id, chunk_index, content, token_count, embedding vector(1536), metadata jsonb }`.
- Enable `pgvector` extension; HNSW index on `embedding`.
- Storage bucket `client-knowledge` (private), RLS scoped to client + org.

**Ingestion edge function `ingest-client-knowledge`:**
- Accepts uploaded file (reuses `process-document` text-extraction path)
- Chunks ~800 tokens with 100 overlap
- Embeds with `google/text-embedding-004` via Lovable AI Gateway (or `text-embedding-3-small` if needed)
- Writes chunks + embeddings, updates `status`

**Retrieval helper `supabase/functions/_shared/clientLens.ts`:**
```ts
buildClientLens(clientId, {
  topic: 'win_themes' | 'requirements' | 'questions' | 'gaps' | 'outline' | 'risks',
  query: string,           // usually the section/requirement text
  topK?: number,           // default 5
  override?: Json          // from solicitation override
}) → { promptBlock: string, citations: KnowledgeCitation[] }
```
- Builds Layer-2 prompt: identity → codes → frameworks → discriminators → glossary → always-flag → voice
- Embeds `query`, runs cosine search filtered by `client_id`, returns top-k with title + chunk text
- Appends a "Reference material from this client's library:" section with numbered snippets the model can cite as `[K1]`, `[K2]`

**UI:**
- "Knowledge Library" tab on `ClientDetail` — upload, list, tag, delete, re-ingest, status pills.
- Citation chips on AI outputs (win themes, gap analysis) link back to the source document with snippet preview.

## Phase 3 — Wire Lens into AI functions

Update each function to call `buildClientLens` and prepend the prompt block + relevant retrieved chunks. Functions to update:
1. `analyze-solicitation` — full lens, no RAG (fast pass)
2. `analyze-sections` — lens + RAG by section text
3. `extract-requirements` — lens (glossary + always-flag matter)
4. `identify-risks-opportunities` — lens + RAG (past performance signals)
5. `generate-questions` — lens + RAG
6. `generate-win-themes` — lens + RAG (heaviest user — cites discriminators + past wins)
7. `generate-outline` — lens
8. `analyze-gaps` — lens + RAG (past performance evidence for capability claims)
9. `compare-solicitations` / revision impact — lens (always-flag rules)
10. `generate-report` — lens (voice + reading level)

Each AI output row stores `lens_version_used` in metadata so we can recompute on lens changes.

## Phase 4 — Lens-change re-analyze

- DB trigger on `client_profiles` update increments `version`.
- Banner on affected solicitations: "Client lens updated — re-run analysis to apply." Buttons trigger existing re-run flows.
- Same banner when `client_knowledge_documents` count changes.

## Settings Help

Add new article `ClientLensArticle.tsx` to Help tab covering: what the lens is, how to fill it, when to use overrides, how RAG citations work, preset library.

## Build Order

1. Migration: `client_profiles`, `solicitations.solicitation_lens_overrides`, presets seed (Phase 1 schema).
2. Client Detail "AI Lens" tab + `ClientLensBadge`.
3. `_shared/clientLens.ts` (profile-only first, no RAG yet) + wire into top-3 functions: `generate-win-themes`, `extract-requirements`, `generate-questions`.
4. Migration: `pgvector`, `client_knowledge_documents`, `client_knowledge_chunks`, storage bucket.
5. `ingest-client-knowledge` edge function + Knowledge Library UI.
6. Add RAG retrieval to `clientLens.ts` and wire into remaining functions.
7. Lens-change re-analyze banner + Help article.

## Technical notes

- Embedding model: `google/text-embedding-004` (1536 dim, free via Lovable AI Gateway).
- Token budget: cap Layer-2 block at ~1.5k tokens; cap retrieved snippets at ~2k tokens combined.
- Cost guard: cache `buildClientLens` result per `(clientId, lensVersion)` for the profile block; only retrieval re-runs per call.
- Backwards compat: if no `client_profiles` row, functions fall back to current behavior with a single-line "No client lens configured" note.
- All new tables use existing `current_user_org()` / `is_org_staff()` RLS pattern.

Ready to implement on approval.
