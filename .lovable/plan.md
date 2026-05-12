## Goal

Add a new report type **Client Strategic Questionnaire** to the report list. It reuses the branded styling we built for the existing Strategic Questions Brief and adds the additional structural sections shown in the uploaded V2 sample (`Inverness_Strategic_Questions_Brief_V2.docx`):

1. Cover page (firm name, title, sol#, agency, generated date)
2. Stats strip (Submitted / Strategic Hold / Internal Only / Issue Categories)
3. Executive Summary block
4. Issue Category Legend (2-column grid with color dot, name, count, description)
5. Quick Reference Index (single table: # · Category · Source · Topic/Summary, all submitted questions)
6. Per-question detail pages — `Question N | CATEGORY | Source` header, "Question to Ask" body, Source row, Rationale row
7. Strategic Hold Questions section (same per-question card style)
8. Internal Only Items section

## Where it lives in the UI

- New entry in `REPORT_TYPES` array (`src/features/reports/templates/types.ts`) with id `client_questionnaire`, title "Client Strategic Questionnaire", description "Client-ready questionnaire: cover, executive summary, legend, index, full Q&A detail."
- Icon mapping in `ReportTypeSelector.tsx` (use `ClipboardList` from lucide).
- Appears alongside existing cards in `/solicitations/:id?tab=reports`.

## Generation pipeline

`supabase/functions/generate-report/index.ts` adds a branch when `reportType === "client_questionnaire"` that builds structured `blocks` (no AI call needed — same data source as `questions_brief`):

```text
Section 1  Cover                → coverHero block (new)
Section 2  At a Glance          → statsStrip
Section 3  Executive Summary    → paragraph (from existing summary if present, else generated count line)
Section 4  Issue Category Legend → categoryLegend block (new) — 2-col grid of dot+name+count+desc
Section 5  Quick Reference Index → indexTable block (new) — # · Category · Source · Topic
Section 6  Submitted Questions  → categoryBand + questionCard (existing blocks, reused)
Section 7  Strategic Hold       → questionCard
Section 8  Internal Only        → questionCard
```

## New block kinds (`src/features/reports/templates/blocks.ts`)

- `coverHero` — `{ firm, title, solicitationNumber, agency, generatedAt, confidential?: boolean }`
- `categoryLegend` — `{ items: Array<{ tone, label, count, description }> }`
- `indexTable` — `{ rows: Array<{ index: number; tone: CategoryTone; categoryLabel: string; source: string; topic: string }> }`

Existing `statsStrip`, `categoryBand`, and `questionCard` are reused as-is.

## PDF rendering (`src/features/reports/utils/pdfGenerator.ts`)

- `drawCoverHero` — full-page cover: navy band with firm name top, large title centered, sol# + agency line, generated date footer. Forces a page break after.
- `drawCategoryLegend` — 2-column grid; each cell = colored dot in category tone + uppercase label + `(N questions)` + small description.
- `drawIndexTable` — striped rows, narrow # col, colored category pill, source col, wrapping topic col. Auto page-break with repeated header row.
- Hook all three into the `drawBlock` switch.

## Word rendering (`src/features/reports/utils/wordGenerator.ts`)

- Cover = section with single full-page `Table` (1×1) holding centered paragraphs, then `PageBreak`.
- Legend = 2-column `Table` of cells with colored shading bars for each tone.
- Index = standard `Table` with header row + per-row category color in the category cell.
- Wire each into the block dispatcher.

## Data flow

The edge function already loads the question set (categories, sources, topics, rationales). For this report it skips the AI prompt entirely and emits the deterministic block list above. Stats counts derive from the same grouping logic used today for `questions_brief`.

## Out of scope

- No changes to existing `questions_brief` output.
- No new editor / customization UI — branding fields (`firm`, `clientLogo`) reuse `ReportOptions.branding`.
- Inverness logo art remains text-only on the cover (matches what the brief does today).
- No new database columns; the report is saved through the existing `reports` + `report_exports` tables.

## Files touched

- `src/features/reports/templates/types.ts` — add `client_questionnaire` type + REPORT_TYPES entry
- `src/features/reports/templates/blocks.ts` — add 3 block kinds
- `src/features/reports/templates/theme.ts` — no changes (existing CategoryTone palette covers all 7 categories)
- `src/features/reports/utils/pdfGenerator.ts` — 3 new draw functions + switch wiring
- `src/features/reports/utils/wordGenerator.ts` — 3 new builders + switch wiring
- `src/features/reports/components/ReportTypeSelector.tsx` — add icon mapping
- `supabase/functions/generate-report/index.ts` — new branch for `client_questionnaire`

## Open questions (will assume defaults unless you say otherwise)

1. Use the firm name from `branding.headerText` as the cover header (defaults to "INVERNESS" if blank)?
2. Include the "CONFIDENTIAL" stamp in the running header on every page (matches sample)?
3. Default output formats = both PDF and Word, like other reports?
