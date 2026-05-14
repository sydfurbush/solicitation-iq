## Problem

In the question detail panel and card, the "Source" block currently shows only the quote and a section label (e.g. "Section VOLUME I – EXPERIENCE"). It never says **which document** the quote came from, even though each question stores a `source_document_id` linking to a row in `documents` (with `file_name`). Users can't tell whether a citation refers to the PWS, an attachment, an amendment, etc.

## Recommendation (do all three)

### 1. Always show the document file name with the citation (required fix)

In both `QuestionDetailPanel.tsx` and `QuestionCard.tsx`, resolve `question.source_document_id` against the `documents` array already passed in (id → file_name) and render it as the primary line of the source block:

```
📄 RFP-Attachment-J1-PWS.pdf
   Section VOLUME I – EXPERIENCE
   "The Offeror shall submit two examples..."
```

- Use a `FileText` icon + filename as the headline.
- Keep section/citation as secondary muted text.
- If `source_document_id` is missing or unresolved, show "Document not specified" so the gap is visible instead of silently hidden.
- `QuestionCard` currently only passes `source_citation` to `CitationLink`; extend it to also receive the resolved filename (pass `documents` down from `QuestionsList`, or look up via a small `useDocuments`-style map).

### 2. Make the document name clickable

Wrap the filename in a link/button that opens the document:
- Primary: navigate to `/solicitations/:id?tab=phase-1&step=documents&doc=<id>` (or whichever existing route opens a document viewer — confirm during implementation).
- Secondary: if no in-app viewer exists for that document, fall back to opening the file in a new tab via a signed URL from the `documents` storage bucket.

### 3. Surface the document in list/export/filter contexts

- **Question cards:** add a small `Badge` with the filename next to the category badges so users see the source doc without opening the panel.
- **Export (`questionHelpers.ts`):** add a `Source Document` column alongside the existing `Source Citation` / `Source Quote` columns.
- **Filters (`QuestionsFilters.tsx`):** add an optional "Source document" facet so users can filter questions by which document they came from. Useful for the 200+ question case.

## Optional follow-ups (ask user before doing)

- **Backfill check:** run a one-off query to count how many existing AI-generated questions have a `NULL` or invalid `source_document_id`. If many are missing, the generator prompt may need to require it explicitly. Report counts; don't auto-mutate.
- **Generator hardening:** update `generate-questions/index.ts` so each emitted question must include the document id it was derived from, and reject/repair items missing it before insert.
- **Section deep-link:** if the document viewer supports anchors, deep-link the citation (e.g. `&section=VOLUME%20I`) so clicking jumps directly to the cited section.

## Technical notes

- Data is already there: `strategic_questions.source_document_id` → `documents.id`, with `documents.file_name` available. No schema change needed for items 1–3.
- `documents` array is already passed into `QuestionDetailPanel` and `SolicitationQuestions`; `QuestionsList` / `QuestionCard` need to receive it (or a `Map<id, file_name>`) as a new prop.
- No backend or migration work required for the core fix.

## Out of scope

- Changing question generation logic.
- Re-running generation to repopulate missing source documents (would be a separate approval).
