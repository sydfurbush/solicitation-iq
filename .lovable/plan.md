# Fix "Search in document text…" in the Document viewer

## Problem

In `src/features/documents/components/DocumentViewer.tsx` (the right-side sheet shown in the screenshot, Content tab), the search input only injects `<mark>` highlights into the extracted text. For a 102-page document the highlighted match is usually scrolled far below the visible area, so typing appears to do nothing. There is also no feedback on whether matches were found.

Additionally, when a PDF has extracted text, the viewer currently picks the iframe path only when `extracted_text` is empty — which is correct — but the search box is also rendered above the iframe where it has no effect on the PDF iframe. We'll keep search visible only when we can actually search (extracted text is present).

## Fix

Upgrade the in-document search to a real find experience:

1. **Match counting + navigation**
   - Show "n of N" next to the input plus ChevronUp / ChevronDown buttons and Enter / Shift+Enter shortcuts.
   - Track the active match index in component state.

2. **Scroll the active match into view**
   - Tag each match span with a stable id (`data-match-index`).
   - Style the active match differently (e.g. `bg-amber-400`) vs other matches (`bg-amber-200`).
   - On index change, call `scrollIntoView({ block: "center" })` on the active node inside the `ScrollArea`.

3. **Reset behavior**
   - When the search term changes, reset active index to 0 and scroll to the first match.
   - When the sheet closes or the document changes, clear the search (already done).

4. **Hide the search box for the iframe path**
   - Only render the search input when we're showing extracted text (i.e. not the raw PDF iframe), so users don't think a non-functional box is broken.

5. **Empty state**
   - When the term is ≥ 2 chars and there are 0 matches, show "No matches" inline next to the counter.

## Files touched

- `src/features/documents/components/DocumentViewer.tsx` — only file changed. Refactor `HighlightedText` into a small component that accepts `term`, exposes match count via callback, and supports an `activeIndex` prop for styling + scroll.

## Out of scope

- The global `DocumentSearchBar` (top-of-page search across all documents) — that one already works via the `search_document_content` RPC.
- No edge-function, schema, or RPC changes.
- No design-system token changes; reuse existing amber highlight styling.
