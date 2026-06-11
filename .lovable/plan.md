# Simplify Assistant Export — Match On-Screen Formatting

Reduce the Export dropdown on the Assistant chat to high-quality, fully-formatted output only, and make the exported file look the same as what is rendered in the message window.

## New export menu

The `Export` button on the assistant thread will show exactly three options:

1. **Copy formatted** — copies the transcript as rich text so it pastes into Word, Outlook, Google Docs, or email with the same formatting as the chat.
2. **Download Word (.docx)**
3. **Download PDF (.pdf)**

Removed: "Copy as markdown" and "Download .md".

## Fidelity requirement: match the message window

The export must mirror what the user sees on screen, not a re-rendered markdown approximation. That means:

- Headings, bold/italic, bullet & numbered lists, blockquotes, inline code, fenced code blocks, GFM tables, and GFM task lists render with the same hierarchy and spacing as the chat.
- The `OrgChartBlock` renders as the visual card grid (role title, meta, bullets) — not the raw ASCII source.
- Mermaid diagrams render as their generated SVG — not the source text.
- User and Assistant turns use the same bubble/label styling, timestamps, and citation footer as the chat.
- Typography (font family, sizes, code background, table borders, link color) matches the live theme.

## Implementation

The cleanest way to guarantee parity is to capture the same React tree the chat uses, then serialize it.

New file: `src/features/assistant/lib/exportFormatted.ts`

- `renderTranscriptToHtml(thread, messages)` — mounts a hidden, off-screen `<div>` and uses `ReactDOM.createRoot` to render a new `<TranscriptDocument>` component (see below) into it. After the next paint (and after Mermaid finishes — we poll for `svg` presence inside any `MermaidBlock`), it reads `innerHTML`, inlines the computed styles for typography/colors/borders/backgrounds so the markup is self-contained, then unmounts. Returns a complete HTML string wrapped in `<html><head><style>…print CSS…</style></head><body>…</body></html>`.

New file: `src/features/assistant/components/TranscriptDocument.tsx`

- A presentational component that renders a cover block (title, persona, plain-mode, export date) followed by each non-system message using the **exact same** `MessageRow` / `MarkdownBody` rendering path the chat uses (same `react-markdown` config, same `OrgChartBlock`, same `MermaidBlock`, same GFM plugins, same table/list/code styles). It just lays them out top-to-bottom with speaker + timestamp labels instead of the chat scroller. No virtualization, no input bar, no action buttons.

Updated file: `src/features/assistant/components/ExportThreadButton.tsx`

- Remove `doCopyPlain` and the markdown `doDownload` handler.
- `doCopyRich` → keep, label "Copy formatted", source HTML now comes from `renderTranscriptToHtml` (not from re-parsing markdown with `marked`), so pastes into Word match the chat exactly.
- `doDownloadPdf` → write the HTML into a hidden same-origin iframe, wait for `load` + mermaid SVGs + web fonts (`document.fonts.ready`), then call `iframe.contentWindow.print()`. The browser print dialog produces a high-quality, vector PDF that matches the chat styling.
- `doDownloadDocx` → convert the rendered HTML to `.docx` via the existing `docx` library. Walk the DOM produced by `TranscriptDocument`:
  - Headings → `Paragraph` with matching `HeadingLevel`.
  - Paragraphs / bold / italic / inline code → `TextRun` with style flags.
  - `<ul>` / `<ol>` / GFM task lists → `Paragraph` with `LevelFormat.BULLET` / `DECIMAL` numbering config; checked tasks prefixed with `☑`, unchecked with `☐`.
  - `<pre><code>` → single-cell `Table` with light-gray `ShadingType.CLEAR` background and monospace `TextRun`s, one paragraph per line.
  - GFM `<table>` → `docx` `Table` with dual widths (table `columnWidths` and per-cell `width` in DXA), header row shaded.
  - `MermaidBlock` `<svg>` → rasterize to PNG via an off-screen canvas and embed as `ImageRun` so the diagram appears in Word.
  - `OrgChartBlock` cards → rendered as a `docx` `Table` (one row per role) with title bolded and bullets beneath, matching the on-screen card.
  - Citations footer → small italic `TextRun`.
  - US Letter page size (12240 × 15840 DXA), 1-inch margins, footer with `PageNumber.CURRENT`.

Updated file: `src/features/assistant/components/ExportThreadButton.tsx` icons → `Copy`, `FileText` (Word), `FileDown` (PDF).

No backend changes. No new dependencies — uses existing `docx`, `react-dom`, the project's existing react-markdown stack, and browser print for PDF.

## Out of scope

- No styling changes to the chat itself.
- `buildTranscriptMarkdown` stays as the canonical plain-text fallback used internally by `copyRich`'s text-blob alternative, but is no longer surfaced in the menu.
