## Issues observed (from screenshot, page 6 of 23)

1. **Index table — SOURCE column overflows into TOPIC column** (rows 46, 50, 51).
   Source text contains long unbreakable tokens like `&S&u&r&v&e&i&l&l&a&n&c&e&P&l&a&n&n&e&d` (PDF-extraction artifacts from the underlying solicitation text). `splitTextToSize` only wraps on whitespace and our `hardBreakWord` helper only inserts wrap opportunities after `+ _ / \ . -`. The `&`-glued tokens stay as one giant "word" and get drawn full-width across the SOURCE cell, visually overlapping the adjacent TOPIC cell text.

2. **Q1 category badge wraps "CONTRADICTIO / N"**.
   In `drawQuestionCard`, the label cell is `labelW = 70pt` and the inner badge is `labelW − 12 = 58pt` wide. "CONTRADICTION" at 7pt bold is ~64pt wide, so jsPDF wraps it across two lines, breaking mid-word.

3. **Same root cause as #1 also produces the visible "double-printed" topic line** in rows 46/50/51 — the oversize SOURCE line draws over the TOPIC line at the same Y baseline because the SOURCE row never re-wraps.

## Fix

### 1. `src/features/reports/utils/textBreaks.ts`
Expand `BREAK_CHARS` so we also insert wrap opportunities after the punctuation that commonly appears in extracted solicitation text:
- Add `&`, `;`, `,`, `:`, `|`, `§`, `#`, `=`
- Lower the default `threshold` from 16 → 12 so medium-length glued tokens also get broken

```ts
const BREAK_CHARS = /([+_/\\.\-&;,:|§#=])/g;
```

This keeps real words (≤ threshold) untouched but breaks the `&S&u&r&v…` and `36C10X26Q0099` style strings.

### 2. `src/features/reports/utils/pdfGenerator.ts` — `drawIndexTable`
Belt-and-suspenders against any remaining oversize tokens: clip each cell's text to its column.

- After computing `topicLines` / `srcLines`, additionally truncate any single rendered line whose width exceeds the column with an ellipsis (use `doc.getTextWidth` to measure; trim chars until it fits, append `…`).
- Apply the same to `categoryLabel` lines so badge content can never escape the pill.

### 3. `src/features/reports/utils/pdfGenerator.ts` — `drawQuestionCard` badge
Stop the badge from wrapping mid-word:

- Widen `labelW` from `70` → `84` (gives the badge ~72pt of usable width — fits "CONTRADICTION" at 7pt).
- Recompute `bodyX` / `bodyW` from the new `labelW` (already derived from it, so just the constant changes).
- As a safeguard, if `categoryLabel.toUpperCase()` measured at 7pt still exceeds `labelW − 12`, drop the font to 6.5pt before wrapping. If still too wide, hard-break with `hardBreakWord(label, 8)` so the wrap happens at a punctuation point rather than mid-word.

### 4. `src/features/reports/utils/wordGenerator.ts` (parity)
The Word export uses `softBreakWord` against the same data. Since `BREAK_CHARS` is shared, fix #1 automatically improves the Word output too — no separate change needed. (Will spot-check after edits.)

## Out of scope

- Cleaning the underlying garbled source text upstream (in the `generate-report` edge function or document-extraction pipeline). That's a data-quality fix worth doing later, but the PDF renderer should never let a single token break the layout regardless of input.
- Visual restyling of the index table or question cards beyond what's needed to fix the overflow / wrap.

## Verification

- Re-export the report for solicitation `1095001d-…` and open page 6.
- Confirm: rows 46/50/51 — SOURCE text wraps inside its column, TOPIC column has no overlapping ghost text.
- Confirm: Q1 badge reads "CONTRADICTION" on a single line (or wraps at a clean break, not mid-word).
- Spot-check other pages for any newly-introduced excessive wrapping in clean rows.
