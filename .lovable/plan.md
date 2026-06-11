# Fix Word Export — Mermaid SVG renders as raw CSS text

## Root cause

In `src/features/assistant/lib/exportFormatted.ts`, `downloadAssistantDocx()` walks the rendered HTML body and converts each element to docx blocks. When it hits a Mermaid diagram, the diagram is an inline `<svg>` whose first child is a `<style>` element with all of mermaid's generated CSS. The walker has no special case for `<svg>` or `<style>`, so it falls through to `collectRuns()` which reads `textContent` — dumping the entire CSS stylesheet (`#mermaid-rlc{font-family:inherit;…`) into the document as a paragraph. That is exactly what the screenshot shows.

PDF export and the "Copy formatted" path are not affected because both keep the live SVG, which renders correctly in browsers and email/Word paste targets.

## Fix

### 1. Rasterize SVGs to PNG before docx generation

In `downloadAssistantDocx`, after `renderTranscriptToHtml` produces the body HTML, locate every `<svg>` in the temporary container and convert each to a PNG `data:` URL:

- Serialize the SVG with `XMLSerializer`.
- Wrap in a `Blob` (`image/svg+xml`) and `URL.createObjectURL` it.
- Load into a new `Image()`; on `load`, draw it to an off-screen `<canvas>` sized to the SVG's natural width/height (fallback to 800 wide, preserving aspect) at 2× device pixel ratio for crispness.
- Read `canvas.toDataURL("image/png")`, base64-decode to a `Uint8Array`.
- Replace the original `<svg>` node with a placeholder `<div data-docx-image="...">` whose `data-docx-image` attribute carries an index into a parallel `images[]` array of `{ data: Uint8Array, width, height }`.

### 2. Teach the walker about the placeholder

Extend `blockFromElement` to detect `data-docx-image` on a div and emit a `Paragraph` containing an `ImageRun` with `type: "png"`, the captured PNG buffer, and a width sized to fit the page (cap at ~600 px wide, scale height to preserve aspect).

### 3. Skip non-content elements everywhere

In both `blockFromElement` and `collectRuns`, ignore elements with tag name `STYLE`, `SCRIPT`, `NOSCRIPT`, `TEMPLATE`, or `SVG` (the SVG case is now handled by the placeholder above, so any leftover svg in the tree is treated as already consumed and skipped — no fall-through to `textContent`).

Also skip the `<button>` inside `OrgChartBlock` ("Show source" toggle) so its label and any expanded `<pre>` source don't get exported on top of the rendered card.

### 4. Defensive fallback

If SVG rasterization fails (e.g. tainted canvas, missing dimensions), drop a small italic placeholder paragraph "[diagram]" instead of dumping any text — never let raw `<style>` content reach the docx output.

### 5. Verify

After the change, the Word export for the org-chart thread in the screenshot must show:
- The thread title and metadata header.
- The user message bubble.
- The assistant's "Proposed Organizational Chart…" heading and intro paragraph.
- The Mermaid diagram as a properly sized PNG image (not CSS text).
- No leaked `#mermaid-rlc{…}` stylesheet anywhere.

## Files touched

- `src/features/assistant/lib/exportFormatted.ts` only.

No other changes. PDF, Copy formatted, and the on-screen chat are not modified.
