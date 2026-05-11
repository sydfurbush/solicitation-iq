
# Branded Client Report Templates — Option A

Match the uploaded **Army TAP Executive Summary** look across all generated reports (PDF + Word). Replace the current plain `jsPDF` + `docx` generators with a templated, branded renderer.

## Decisions locked in
- **Option A**: full brand match in both PDF and Word.
- **Footer**: default `CONFIDENTIAL — FOR CLIENT USE ONLY` (overridable via `branding.footerText`).
- **Logo**: deferred — leave a slot in the header band for a follow-up.

## Visual spec (from sample)
- **Running header** (every page): bold project name + amber `|` + amber solicitation number, navy/amber rule beneath.
- **Cover band**: solid navy block, small amber eyebrow ("EXECUTIVE SUMMARY"), large white title, white meta line `Solicitation # • Generated <date>`.
- **Section headings**: navy ALL-CAPS with thin amber underline rule.
- **Snapshot table**: navy left column / white bold labels, light-gray right column.
- **Category callout tables**: green header bar for Opportunities, red for Risks; tinted left cell, white right cell.
- **Recommendation box**: cream fill, amber border, centered "RECOMMENDATION / VERDICT" + italic rationale.
- **Numbered Steps table**: navy square w/ white step number, light-blue title cell, white description cell.
- **Source Citations**: flat list `[C#] Document §Section`.
- **Footer**: amber rule, "CONFIDENTIAL — FOR CLIENT USE ONLY" left, "Confidential" right.

## Design tokens
New `src/features/reports/templates/theme.ts`:
- Navy `#1E3A5F`, Amber `#C9A227`, Opp green `#2E7D32` + tint `#E8F3EA`, Risk red `#C62828` + tint `#FBEAEA`, Cream `#FFF8E1`, Light-blue `#EAF2FA`, Slate text `#374151`.
- Fonts: Helvetica (PDF) / Arial (Word).

## Content model
Extend `ReportSection` with optional structured `blocks` (markdown `body` stays as fallback):
```ts
type Block =
  | { kind: "paragraph"; text: string }
  | { kind: "bullets"; items: string[] }
  | { kind: "kv"; rows: Array<[string, string]> }
  | { kind: "category"; tone: "opportunity" | "risk" | "neutral"; title: string;
      rows: Array<[string, string]> }
  | { kind: "recommendation"; verdict: string; rationale: string }
  | { kind: "steps"; items: Array<{ title: string; detail: string }> };

type ReportSection = { id: string; heading: string; level?: 1|2|3;
                       body?: string; blocks?: Block[] };
```

## Files to add / change

**New**
- `src/features/reports/templates/theme.ts` — color/typography tokens.
- `src/features/reports/templates/blocks.ts` — `Block` type + helpers (parse legacy markdown body into a paragraph block when `blocks` is missing).

**Rewrite**
- `src/features/reports/utils/pdfGenerator.ts`
  - Small layout engine on top of `jsPDF`: `drawHeader`, `drawFooter`, `drawCoverBand`, `drawSectionHeading`, `drawKV`, `drawCategory`, `drawRecommendation`, `drawSteps`, `drawCitations`, `ensureSpace` (re-draws header/footer on new page).
- `src/features/reports/utils/wordGenerator.ts`
  - `docx` `Header`/`Footer`, custom `styles` (Heading1 navy ALL-CAPS, etc.), styled `Table`s with shading/borders for KV / category / steps, callout rendered as a single-cell shaded table with amber border.
- `supabase/functions/generate-report/index.ts`
  - Extend the AI tool schema so each section can return optional `blocks` (paragraph/bullets/kv/category/recommendation/steps). Keep `body` markdown for prose-only sections. Update the per-report-type prompts in `src/features/reports/templates/prompts.ts` to ask the model to use:
    - `kv` for "Opportunity Snapshot",
    - `category` (opportunity/risk) for "Strategic Assessment",
    - `recommendation` for "Recommendation",
    - `steps` for "Next Steps".

**Touch (minor)**
- `src/features/reports/templates/types.ts` — export new `Block` type, allow `body?` and `blocks?` on `ReportSection`.
- `src/features/portal/components/ClientReportViewer.tsx` — render the new block types inline so the in-app preview matches the downloaded file (KV tables, callouts, steps).

**Branding hook** — already present on `ReportOptions.branding`:
- `headerText` → top running header (defaults to solicitation title).
- `footerText` → footer left (defaults to `CONFIDENTIAL — FOR CLIENT USE ONLY`).
- `firmLogoUrl` slot reserved in cover band but not rendered yet.

## Verification
1. Generate Executive Summary on the current solicitation (`/solicitations/0d2c19f3…?tab=reports`) → PDF + Word.
2. Open both, confirm: header runs, navy cover band, snapshot table, green/red category tables, cream recommendation box, numbered Next Steps table, citations, footer.
3. Spot-check Risk Assessment and Questions Brief to confirm the shared template still looks right when blocks are sparser.

## Out of scope (follow-ups)
- Firm/client logo upload + placement in header.
- Per-client color theme overrides via `branding.primaryColor`.
- Page-x-of-y numbering and a TOC for long reports.
