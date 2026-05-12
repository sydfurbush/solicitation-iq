# Strategic Questions Brief — Branded Format

Reformat the `questions_brief` report so PDF and DOCX output mirrors the uploaded samples: cover hero, stats strip, color-coded category sections, and a styled card per question.

## What changes (visual)

1. **Cover page** (already mostly there) — keep navy hero with `EXECUTIVE REPORT` eyebrow, title, sol# + generated date. Add a thin amber accent bar on the left of the hero.
2. **Stats strip** — directly under the hero on the cover, render a 5-up tile row(s):
   - Total Questions, Contradictions, Risk Concerns, Quantitative Gaps, Drafting Errors,
   - Compliance, Clarifications, Scope Expansion, Strategic Hold, Internal Items.
   - Tile = light grey value cell on top, navy label cell underneath (matches sample image-22).
3. **Section headers** — `SUBMITTED QUESTIONS`, `STRATEGIC HOLD QUESTIONS`, `INTERNAL DISCUSSION ITEMS` rendered as a 2-row band: thin grey row on top, full-width navy bar with white uppercase title underneath.
4. **Per-category band** inside Submitted Questions — full-width grey bar reading e.g. `CONTRADICTIONS (29 questions)`, in the category color.
5. **Question card** — replaces the current bullet list. Each card has:
   - Left amber gold rule (accent),
   - Two-column row: left tinted cell with `Q##` and a colored category badge (`CONTRADICTION`, `RISK CONCERN`, `QUANTITATIVE GAP`, `COMPLIANCE`, `DRAFTING ERROR`, `CLARIFICATION`, `SCOPE EXPANSION`, `STRATEGIC`),
   - Right cell with question text, italic `Rationale:` line, amber `Source:` line.
6. **Page header** — `INVERNESS | W9124D26RA041 | CONFIDENTIAL` (client | sol# | confidential), thin amber rule under it.
7. **Page footer** — `Strategic Questions Brief — {title}  |  Page X of Y`.

## Category color map

| Category | Badge bg / band tint |
|---|---|
| contradiction | navy `#1E3A5F` / light navy tint |
| risk concern | coral `#E57373` / `#FBEAEA` |
| quantitative gap | green `#2E7D32` / `#E8F3EA` |
| compliance | teal `#26A69A` / `#E0F2F1` |
| drafting error | purple `#9575CD` / `#EDE7F6` |
| clarification | sky `#42A5F5` / `#E3F2FD` |
| scope expansion | amber `#F4A95B` / `#FFF3E0` |
| strategic | pink `#EC407A` / `#FCE4EC` |

Map computed from `category` (case-insensitive, normalized).

## Technical changes

```text
src/features/reports/templates/blocks.ts
  + add Block kinds:
    - { kind: "statsStrip"; tiles: Array<{ label: string; value: number | string }> }
    - { kind: "categoryBand"; title: string; count: number; tone: CategoryTone }
    - { kind: "questionCard"; index: number; category: string;
        question: string; rationale?: string; source?: string;
        agencyResponse?: string }
  + export CATEGORY_TONES + tone color resolver

src/features/reports/templates/theme.ts
  + add per-category RGB + HEX entries for the 8 tones above

src/features/reports/utils/pdfGenerator.ts
  + drawStatsStrip(), drawCategoryBand(), drawQuestionCard()
  + extend drawBlock() switch
  + page header: support 3-segment "client | sol# | CONFIDENTIAL"
  + page footer: include report title and "Page X of Y" (two-pass for total)

src/features/reports/utils/wordGenerator.ts
  + statsStripTable(), categoryBandParagraph(), questionCardTable()
  + extend block dispatch
  + matching header/footer

supabase/functions/generate-report/index.ts  (deterministic questions_brief branch)
  - replace bullets with structured blocks:
      • prepend statsStrip computed from counts by category + group totals
      • SUBMITTED section: group rows by category, emit categoryBand + questionCards
      • STRATEGIC HOLD + INTERNAL sections: questionCards (no inner band needed,
        but still color-coded badges by category)
  - keep existing intro paragraph per section
  - retain citations section (unchanged)
```

No DB schema changes. No prompt changes (path is deterministic). Other report types are untouched (new block kinds are additive — existing renderers ignore them only if not used; the switch will cover them).

## Out of scope

- Inverness logo art (text-only header for now; user can wire a `firmLogoUrl` later via existing branding options).
- Reordering/customization UI for which categories appear in stats.
- Changing AI-generated reports (executive_summary, full_analysis, etc.).

## Risk / mitigation

- DOCX cell borders + colored bands tested against existing `kvTable`/`categoryTable` patterns already in `wordGenerator.ts`.
- PDF "Page X of Y" requires a second pass; will use `doc.getNumberOfPages()` after layout to stamp the totals.
- Color tokens added to `theme.ts` only — components/UI unaffected.
