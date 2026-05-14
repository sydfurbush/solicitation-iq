## Goal

Stop treating the source document as a clickable link. Display it as plain text positioned **below** the "Section:" line, both in the in-app question views and in generated reports.

## UI changes

### 1. `QuestionDetailPanel.tsx` — Source block reorder
Current order under "Source": document link → quote → section.
New order:
1. Quote (blockquote, unchanged)
2. `Section: <citation>` (unchanged styling)
3. `Document: <file name>` — plain muted text, same styling as the Section line. No icon, no button, no navigation. Show `Document: Not specified` when `source_document_id` is null/unknown.

### 2. `QuestionCard.tsx` — inline source row
Replace the `<SourceDocumentLink ... />` button with a plain text span. Render order on the card footer:
- `· Section: <citation>` first
- `· <file name>` second (muted, no link, no icon)

### 3. `SourceDocumentLink.tsx`
Convert to a plain-text presentational component (no `<button>`, no `useSearchParams`, no icons, no navigation). Keep the same prop signature so call sites don't need to change. It just resolves `documentId → file_name` and renders muted text. Optionally rename usages to a simpler inline span — but keeping the component minimizes churn.

## Report changes

### 4. `runReport.ts` (HTML run report)
- Extend the `strategic_questions` select to include `source_document_id`.
- Fetch the document map (`id → file_name`) for the run's solicitation (single `documents` query, filtered to ids that appear).
- In the per-question HTML, replace the single `Source:` line with two lines in this order:
  - `<p class="src"><strong>Section:</strong> {source_citation}</p>`
  - `<p class="src"><strong>Document:</strong> {file_name || "Not specified"}</p>`

### 5. `clarificationPackageGenerator.ts` (PDF clarification package)
Both render paths (around lines 134 and 223) currently emit a single "Reference" block. Update both to emit:
- `Section: <reference or source_citation>`
- `Document: <file_name or "Not specified">`

The generator already has access to documents via the questions' solicitation context — verify the doc lookup map is available; if not, accept a `docMap` parameter from the caller and pass `{ id → file_name }` in.

## Out of scope
- CSV/text export already shows "Source Document" as a separate column — leaves as-is unless you want it reordered too.
- No DB / edge function changes.
