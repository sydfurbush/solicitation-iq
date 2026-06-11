# Standardize AI Assistant → Word output

## Goal

Make every `.docx` that flows out of the AI Assistant go through one place that enforces the docx-js rules from the `docx` agent skill (US Letter sizing, real bullet/number lists, dual-width tables, no `\n`, smart-quote-safe text, no unicode-bullet hacks). Two surfaces are in scope:

1. The existing **Export → Word (.docx)** menu in the chat header (`ExportThreadButton`).
2. A new **Save as Word** action on any individual AI-generated assistant message (so when the assistant proposes an artifact — a draft, a memo, a clarification, a list — the user can grab just that message as a properly-formatted Word doc).

Plain formatting only. The org Brand Template is intentionally **not** applied here.

## What gets built

### 1. New shared helper: `src/features/assistant/lib/docxKit.ts`

A small, opinionated module that other code calls instead of touching the `docx` npm package directly. It is the single chokepoint where the skill rules live.

Exports:

- `LETTER_SECTION_PROPERTIES` — US Letter 12240×15840 DXA + 1" margins (skill rule: never rely on docx-js default A4).
- `STANDARD_NUMBERING` — `bullets` and `numbers` configs using `LevelFormat.BULLET` / `LevelFormat.DECIMAL` (skill rule: never insert `•` or `\u2022` as literal text).
- `markdownToDocxBlocks(md: string): (Paragraph | Table)[]` — converts assistant markdown (incl. tables, code fences, blockquotes, task lists, links) to docx blocks. Internally reuses the existing `collectRuns` / `blockFromElement` logic already in `exportFormatted.ts` by extracting them into this module.
- `buildPlainDocx({ title, subtitle?, blocks, footerText? }): Document` — assembles a `Document` with the section properties, numbering, default fonts, header/footer (page numbers), and the provided blocks. No brand colors, no logo.
- `saveDocx(doc: Document, filename: string): Promise<void>` — wraps `Packer.toBlob` + `file-saver`, with filename slugification.

Skill-rule guardrails enforced inside `docxKit`:

- All tables get both `columnWidths` and per-cell `width` in DXA (no `WidthType.PERCENTAGE`).
- Shading uses `ShadingType.CLEAR`.
- `PageBreak` only ever emitted inside a `Paragraph`.
- `ImageRun` always passes an explicit `type`.
- Newlines in source markdown become separate `Paragraph`s, never literal `\n` in a `TextRun`.
- Smart quotes preserved (markdown already carries them; no entity substitution needed in docx — that rule is XML-only).

### 2. Refactor `src/features/assistant/lib/exportFormatted.ts`

- Move the docx-building portion (`collectRuns`, `blockFromElement`, `NUMBERING_CONFIG`, the `Document` assembly inside `downloadAssistantDocx`) into `docxKit.ts`.
- `downloadAssistantDocx` becomes a thin caller: render transcript DOM → rasterize SVGs → `markdownToDocxBlocks` per turn → `buildPlainDocx` → `saveDocx`.
- PDF/HTML/clipboard paths are unchanged.

### 3. New per-message action

- New component `src/features/assistant/components/MessageSaveAsWordButton.tsx`: small ghost icon button (lucide `FileDown`) that takes an `AssistantMessage`, extracts its text/markdown parts, runs `markdownToDocxBlocks` + `buildPlainDocx`, and saves as `<thread-slug>-message-<shortId>.docx`. Filename falls back to `assistant-message-<shortId>.docx` when no thread context is available.
- Mount it in the existing assistant message toolbar. Search for the component that already renders the per-message copy/regenerate icons (likely `AssistantMessageActions` / inside `AssistantChat.tsx`); add the new button beside copy. Only show for assistant-role messages with non-empty text.

### 4. No changes to other doc generators

`clarificationPackageGenerator.ts`, `wordGenerator.ts`, and `compile-proposal/index.ts` keep their current bespoke layouts (they have specific structure requirements beyond plain). The skill rules are still observed there; this plan does not refactor them. We can revisit later if you want a project-wide migration.

## Files touched

- **add** `src/features/assistant/lib/docxKit.ts`
- **edit** `src/features/assistant/lib/exportFormatted.ts` (refactor to use `docxKit`)
- **add** `src/features/assistant/components/MessageSaveAsWordButton.tsx`
- **edit** the assistant message row component to mount the new button (exact file confirmed at implementation time)

## Out of scope

- Brand Template / logo / header colors.
- Edge-Function-side document generation. The split stays as-is: chat exports client-side; `compile-proposal` server-side.
- Migrating `clarificationPackageGenerator` / `wordGenerator` / `compile-proposal` to the shared helper.
- Any PDF changes.

Used the `docx` skill to derive the helper's rule set.
