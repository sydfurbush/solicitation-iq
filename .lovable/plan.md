## Problem (from screenshots)

**Image 17** (current):
- "Recommendation," "Key Success Factors," and "Next Steps" all render as one wall of text under a single Recommendation heading. Cause: AI is emitting them as a single `paragraph` block instead of separate sections with `recommendation` / `bullets` / `steps` blocks.
- Top of every page has too much vertical space between the running header and the first content.

**Image 18** (target): Cream-and-amber RECOMMENDATION callout, then a "Key Success Factors" subheading + bullet list, then a NEXT STEPS section with the navy/light-blue numbered table. The renderers for all three already exist — the AI just isn't using them.

## Changes

### 1. Tighten top spacing
- `pdfGenerator.ts`: `MARGIN.top 64 → 36`, `HEADER_H 36 → 18`, gap before first content `12 → 6`. Footer untouched.
- `wordGenerator.ts`: `page.margin.top 1800 → 1080`, `header offset 720 → 432`, drop trailing space on header paragraph.

### 2. Force structured blocks in the executive summary prompt
Rewrite `PROMPTS.executive_summary` in `supabase/functions/generate-report/index.ts` with a strict per-section contract. Each bullet below = one separate section returned in `sections[]`, in order, each with the required block kinds and nothing else:

1. **Executive Overview** — 1-2 `paragraph` blocks.
2. **Opportunity Snapshot** — exactly one `kv` block; rows: Agency, Solicitation #, Contract Type, Set-Aside, Incumbent, Release Date, Q&A / Proposal Due, Award Date.
3. **Strategic Assessment** — one `category` (tone=opportunity, title="TOP OPPORTUNITIES", 3 rows) + one `category` (tone=risk, title="TOP RISKS", 3 rows).
4. **Competitive Positioning** — one `paragraph` + one `bullets` block.
5. **Recommendation** — exactly one `recommendation` block (verdict + rationale). No paragraphs, no bullets in this section.
6. **Key Success Factors** — exactly one `bullets` block (3-5 items).
7. **Next Steps** — exactly one `steps` block (3-5 items, each `{title, detail}`).

Add an explicit "DO NOT bundle multiple sections together; DO NOT use paragraph/markdown for Recommendation, Key Success Factors, or Next Steps" rule. Strengthen `BLOCKS_GUIDE` with a one-line example per kind.

### 3. Defensive normalization
In the `normalizeSections` helper, if a section heading matches "Recommendation" / "Key Success Factors" / "Next Steps" but the AI returned a `paragraph` block, log a warning. (Don't try to auto-split — rely on the strengthened prompt.)

### 4. Out of scope
- Renderers in `pdfGenerator.ts` / `wordGenerator.ts` already match Image 18 — no rendering changes beyond the spacing tweaks above.
- `ClientReportViewer.tsx` already renders all block kinds — no change.
- Logo upload, page x-of-y, TOC.

## Verification
1. Generate a fresh Executive Summary on the current solicitation.
2. Confirm: tighter top gap, RECOMMENDATION callout renders as cream/amber box, Key Success Factors appears as its own section with bullets, Next Steps renders as the numbered navy/light-blue table.
3. Download both PDF and Word; spot-check page 2/3 spacing.

Older reports won't update — user can click "Generate report" again to refresh.
