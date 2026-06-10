# Capability Injector — Plan

## Goal
Let staff upload a client's capability statement (PDF / DOCX / PPTX / TXT) and have AI extract structured fields that pre-fill the **Capabilities profile** on the client Overview. User reviews and confirms before anything is saved.

## Current state (so the plan fits the codebase)
- Capabilities profile is stored in `clients.metadata.capabilities` as a small JSON blob (`core_capabilities`, `naics_codes`, `certifications`, `differentiators`, `past_performance`, `key_personnel`, `teaming_partners`, `notes`) — edited via `CapabilitiesEditor.tsx`.
- A separate, richer `client_profiles` table exists (NAICS, PSCs, agencies, vehicles, tech stack, etc.) — used by Deep Dive gap analysis.
- Document ingestion infra already exists: `client-knowledge` storage bucket + `ingest-client-knowledge` edge function that downloads + extracts text from PDF/DOCX/XLSX and chunks/embeds it.
- Lovable AI Gateway is wired up for other extractors (`generate-preset`, `extract-requirements`, etc.).

## Recommended approach — "Review-then-apply" extractor
Reuse the existing storage + parsing pipeline, add a new edge function that does AI extraction only, and surface a small dialog in the Capabilities profile card.

### Flow
1. Staff clicks **"Inject from document"** on the Capabilities profile card.
2. Dialog accepts a file (PDF, DOCX, PPTX, TXT, ≤20 MB) OR a link to an already-ingested client-knowledge document, OR pasted text.
3. File is uploaded to the existing `client-knowledge` bucket (so it doubles as a knowledge source for RAG) with a `source_kind = "capability_statement"` tag.
4. New edge function `extract-capabilities` downloads the file, extracts text (reusing the parser logic already in `ingest-client-knowledge`), sends a structured-output prompt to Lovable AI (`google/gemini-3-flash-preview`) returning JSON matching the `Capabilities` shape **plus** richer fields for `client_profiles` (NAICS, PSCs, certifications, vehicles, agencies, differentiators, past performance bullets, key personnel).
5. The dialog shows a side-by-side diff: existing value vs. extracted value, per field, each with a checkbox.
6. On **Apply**, only checked fields are merged into `clients.metadata.capabilities` and, optionally, `client_profiles` (NAICS / PSCs / agencies / vehicles / certifications). Nothing is overwritten silently.

## Options considered (pick one — default is A)

### Option A — Dedicated extractor function + review dialog (recommended)
- New edge function `extract-capabilities`.
- Reuses existing `client-knowledge` bucket and parsers.
- Returns structured JSON; UI lets user accept field-by-field.
- Also writes a `client_knowledge_documents` row tagged as a capability statement so the same doc is available for RAG/gap analysis later.
- Pros: safe (no silent overwrites), one upload feeds both capabilities profile + knowledge index, deterministic schema.
- Cons: one more edge function.

### Option B — Extend `ingest-client-knowledge`
- Same function does chunk/embed AND capability extraction when `source_kind = capability_statement`.
- Pros: fewer functions.
- Cons: mixes two responsibilities, slower ingestion, harder to re-run extraction without re-embedding.

### Option C — Client-side parse + AI call
- Parse PDF in the browser, call AI directly.
- Pros: simplest.
- Cons: bad for large files, no reuse with knowledge pipeline, key handling concerns.

## Schema target (extractor output)
```json
{
  "capabilities": {
    "core_capabilities": "string (markdown)",
    "differentiators": "string",
    "past_performance": "string (bullets)",
    "key_personnel": "string",
    "teaming_partners": "string",
    "notes": "string",
    "certifications": ["8(a)", "ISO 9001", ...],
    "naics_codes": ["541512", ...]
  },
  "profile_hints": {
    "naics_codes": [...],
    "psc_codes": [...],
    "agencies_focus": [...],
    "contract_vehicles": [...],
    "compliance_frameworks": [...],
    "service_categories": [...]
  },
  "confidence": { "<field>": 0..1 },
  "source_excerpts": { "<field>": "verbatim snippet for traceability" }
}
```
Excerpts are shown in the review UI so reviewers can verify each suggestion.

## Files to add / change

### New
- `supabase/functions/extract-capabilities/index.ts` — downloads file (or accepts pasted text / existing `client_knowledge_documents.id`), extracts text, calls Lovable AI with a JSON schema, returns the structured payload. Auth-protected, scoped to org.
- `src/features/clients/components/CapabilityInjectorDialog.tsx` — upload + paste-text tabs, runs extraction, shows per-field diff with checkboxes + source excerpt tooltip, **Apply selected** button.
- `src/features/clients/hooks/useCapabilityExtraction.ts` — `useMutation` wrapper around the edge function.

### Changed
- `src/features/clients/components/CapabilitiesEditor.tsx` — add **"Inject from document"** button next to **Templates** / **Edit**, mounts the new dialog.
- `src/features/clients/hooks/useClientKnowledge.ts` — accept a `sourceKind` tag so the same upload registers as a capability statement (optional, behind a flag in the dialog).
- `supabase/config.toml` — register the new function (verify_jwt = true).

### Optional follow-ups (not in this change)
- Auto-extract on every capability-statement upload (background).
- Versioning: keep a history of extractions per document so we can re-apply after the AI prompt improves.

## Technical notes
- Reuse the PDF/DOCX/XLSX parsing block already in `ingest-client-knowledge/index.ts` — extract it into `_shared/documentText.ts` and import from both functions.
- Use `Output.object({ schema })` (zod) for guaranteed JSON shape.
- Cap extractor input at ~60k characters; if larger, send the first N pages + a summarization pre-pass. Capability statements are typically 4–20 pages, so this is plenty.
- Errors: surface 402 (credits) and 429 (rate limit) to the dialog the same way other AI features do.
- Security: function checks `auth.uid()` is org staff for the target `client_id` before reading storage or returning extraction.

## UX details
- Dialog header: "Inject capabilities from document".
- Tabs: **Upload file** · **Paste text** · **Use existing knowledge doc**.
- After extraction: a table with columns `Field | Current | Suggested | Source excerpt | Apply`.
- Top-of-table actions: "Select all empty fields", "Select all", "Clear".
- Apply button is disabled until at least one row is checked.
- On apply, toast "Updated N fields"; the document remains in client knowledge for later RAG.

## Open questions
1. Should profile_hints (NAICS / PSCs / vehicles / agencies) also write to `client_profiles`, or stay capability-card-only for v1?
2. Should the uploaded file always be stored in `client-knowledge` (recommended) or be ephemeral (parse-and-discard)?
3. Any specific certifications / set-asides taxonomy you want enforced (e.g., normalize to "8(a)", "WOSB", "HUBZone")?
