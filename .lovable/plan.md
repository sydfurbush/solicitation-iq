
# Standardize PDF output across the app (`pdfKit`)

## Goal

Make every `.pdf` produced by the app flow through one helper that enforces the rules from the attached `pdf` skill: US Letter page size, consistent margins/header/footer, page numbers, slug-safe filenames, layout-aware tables, no Unicode subscript/superscript hacks, etc. Then expose three optional recipes — **merge multiple PDFs**, **DRAFT/confidential watermark**, **password protection** — that the skill calls out but none of the current generators can do.

Engine stays **jsPDF + jspdf-autotable** for *generating* PDFs (no rewrite of existing layouts). The three recipes require `pdf-lib` because jsPDF cannot merge, stamp, or encrypt existing PDF bytes; `pdf-lib` is browser-safe and tree-shakeable. No server-side work.

## What gets built

### 1. New module: `src/lib/pdf/pdfKit.ts`

The single chokepoint. Pure helpers, no React. Exports:

- **Constants** — `LETTER`, `MARGINS`, `PALETTE` (header/text/muted), `TABLE_DEFAULTS` (autotable styles), `FONT` (helvetica family + sizes for H1/H2/body/caption).
- **`createPdf(opts)`** — returns a configured `jsPDF` instance in `pt`/`letter` with metadata (`title`, `subject`, `author`, `creator: "Solicitation IQ"`) set via `doc.setProperties`.
- **`drawHeader(doc, { title, subtitle?, meta? })`** — standard top block.
- **`drawFooter(doc, { left?, center?, showPageNumbers })`** — paints on every page at save time (loops `getNumberOfPages`).
- **`writeWrapped(doc, text, opts)`** — wrapped text with auto page-break (lifted from `clarificationPackageGenerator`, generalized).
- **`drawTable(doc, { head, body, startY, columnStyles? })`** — wraps `autoTable` with `TABLE_DEFAULTS` and returns the new `finalY`.
- **`drawDivider(doc, y)`**, **`drawKeyValue(doc, label, value, y)`** — small primitives the existing files re-implement.
- **`slugifyFilename(parts: string[], ext = "pdf")`** — `approvals-foo-bar-20260612-1430.pdf` style.
- **`savePdf(doc, filenameParts)`** — calls `drawFooter` for page numbers, then `doc.save(slugified)`.
- **Skill guardrail comment** at top of file pointing to the `pdf` skill and reiterating: never use `\u2080`–`\u209F` (Unicode subscripts) — use plain text or `^`/`_` notation, since jsPDF's built-in fonts lack those glyphs (same rule the skill flags for ReportLab).

### 2. New module: `src/lib/pdf/pdfRecipes.ts`

Thin wrappers around `pdf-lib` that operate on already-generated PDF blobs/bytes. Exports:

- **`mergePdfs(blobs: Blob[], filename): Promise<Blob>`** — `PDFDocument.create()` + `copyPages` loop.
- **`watermarkPdf(blob, { text, opacity?, angle?, color? })`** — draws diagonal text on every page (used for "DRAFT" stamping). Uses `StandardFonts.HelveticaBold`.
- **`protectPdf(blob, { userPassword, ownerPassword?, permissions? })`** — `pdf-lib` does not ship encryption out of the box; we use the `pdf-lib` companion package **`@cantoo/pdf-lib`** (drop-in fork with `.encrypt()`) **or** fall back to the maintained `pdf-lib` + `pdf-lib-encrypt` shim. Decision at implementation time based on bundle size; final choice noted in the file header.

Recipes are *opt-in*: existing generators don't have to use them. They power a new UI surface (next section).

### 3. New UI: "PDF tools" menu

A small DropdownMenu (rendered where the assistant chat header lives, alongside `ExportThreadButton`) with three actions:

- **Combine PDFs…** — opens file picker (multi-select `.pdf`), calls `mergePdfs`, saves as `combined-<timestamp>.pdf`.
- **Stamp DRAFT on a PDF…** — file picker → `watermarkPdf({ text: "DRAFT" })` → save.
- **Protect a PDF with a password…** — file picker + password dialog → `protectPdf` → save.

These act on *any* user-supplied PDF, not just app output, so the user can combine an approvals PDF with a clarification PDF, etc. Component lives at `src/features/exports/components/PdfToolsMenu.tsx` and is also surfaced on the Reports page.

### 4. Refactor all existing generators to `pdfKit`

Same output, less duplication. Each file shrinks to layout-specific code and delegates page setup/header/footer/filename to `pdfKit`:

- `src/features/assistant/lib/exportFormatted.ts` (`downloadAssistantPdf`)
- `src/features/phases/utils/exportApprovalsPdf.ts`
- `src/features/questions/utils/clarificationPackageGenerator.ts` (`generateClarificationPdf`)
- `src/features/reports/utils/pdfGenerator.ts`
- `src/features/exports/lib/exporters.ts`
- `src/features/writing-queue/lib/exportAssignments.ts`

Visual output stays essentially identical (same fonts/sizes/colors are pulled into `PALETTE`/`FONT`). If a file has a divergent style we intentionally want to preserve, we pass overrides to `createPdf`/`drawHeader` rather than fork the helper.

### 5. Dependencies

- **add** `pdf-lib` (browser, ~330 kB gz; tree-shakes well — only `PDFDocument`, `StandardFonts`, `rgb`, `degrees` are imported).
- **add** `@cantoo/pdf-lib` OR a tiny encryption shim, only if the `protectPdf` recipe survives bundle review.
- No removal — `jspdf` and `jspdf-autotable` stay.

## Files touched

- **add** `src/lib/pdf/pdfKit.ts`
- **add** `src/lib/pdf/pdfRecipes.ts`
- **add** `src/features/exports/components/PdfToolsMenu.tsx`
- **edit** `src/features/assistant/components/AssistantChat.tsx` (mount `PdfToolsMenu` in the chat header next to `ExportThreadButton`)
- **edit** `src/pages/SolicitationReports.tsx` or `src/pages/Reports.tsx` (mount `PdfToolsMenu`)
- **edit** the six generators listed in §4
- **edit** `package.json` (add `pdf-lib`)

## Out of scope

- Switching to server-side (Edge Function) rendering.
- Touching `.docx` output — already standardized via `docxKit`.
- Migrating `compile-proposal` (Edge Function) — its PDF output, if any, is server-side.
- OCR / table-extraction recipes from the skill — those are read-side and not needed here.
- Visual redesign of any existing PDF.

## Technical notes

- jsPDF page numbers are painted at *save* time inside `savePdf` by iterating `1..getNumberOfPages()`. Centralizing this fixes the bug where some current generators only number some pages.
- `slugifyFilename` collapses whitespace, strips non-alphanumerics, lowercases, truncates each part to 50 chars, joins with `-`, appends `yyyyMMdd-HHmm` timestamp. Matches what most current generators do by hand.
- `pdf-lib` recipes operate on `Uint8Array`/`Blob`; we never round-trip through jsPDF for those.
- For `watermarkPdf`, default is light gray `rgb(0.75,0.75,0.75)` at 60° rotation, font size scaled to page diagonal — same look as the skill's `merge_page` watermark recipe.

Used the `pdf` skill to derive the helper's rule set and the merge/watermark/password recipes.
