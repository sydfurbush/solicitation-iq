# Fix Quick Reference Index Overflow

## Root Cause
The Quick Reference Index table renders overflow because the **Source** column contains long unbreakable filename tokens like `IB01_Draft+RFP+Solicitation+-+W9124D26RA041+Professional+Appearance+(20260508).pdf` joined by `+`, `_`, `/`, `.` with **no whitespace**. Both renderers wrap on whitespace only, so these tokens push the column past the right page edge.

- `wordGenerator.ts` `indexTable()` — column widths sum correctly to `CONTENT_W` (9360 DXA), but Word can't break unbreakable strings, so the cell visually overruns.
- `pdfGenerator.ts` `drawIndexTable()` — uses jsPDF `splitTextToSize` which only breaks on spaces; long tokens render past `srcW`.

## Fix (presentation-only, no schema/business changes)

### 1. New helper `src/features/reports/utils/textBreaks.ts`
Two utilities:
- `softBreakWord(s)` — insert U+200B (zero-width space) after `+`, `_`, `/`, `\`, `.`, `-` inside long tokens (>16 chars). Used for Word, where U+200B is a valid wrap opportunity.
- `hardBreakWord(s, maxChars)` — same boundaries but inserts a regular space (so jsPDF's `splitTextToSize` can wrap). Used for PDF.

Apply only to long tokens (length > ~16) so normal text is untouched.

### 2. `wordGenerator.ts` — `indexTable()`
- Run `softBreakWord(r.source)` and `softBreakWord(r.topic)` before rendering.
- Slightly rebalance widths to give Source breathing room: `numW=480`, `catW=1600`, `srcW=2600`, `topicW=CONTENT_W - rest` (was 1800/2200).
- Drop body font from size 18 (9pt) to 16 (8pt) for index rows only.

### 3. `pdfGenerator.ts` — `drawIndexTable()`
- Run `hardBreakWord()` on `r.source` and `r.topic` before passing to `wrap()`.
- Same width rebalance: `numW=28`, `catW=95`, `srcW=150`, `topicW=CONTENT_W - rest`.
- Reduce body font to 8pt to match.

### 4. Verification
After edits, generate a Client Strategic Questionnaire on the affected solicitation and confirm:
- Word: no column overflows the right margin; long filenames wrap mid-token.
- PDF: same — re-render at 150dpi and visually inspect page containing the index.

## Files changed
- new `src/features/reports/utils/textBreaks.ts`
- edit `src/features/reports/utils/wordGenerator.ts` (indexTable only)
- edit `src/features/reports/utils/pdfGenerator.ts` (drawIndexTable only)

No backend, no DB, no template/prompt changes.
