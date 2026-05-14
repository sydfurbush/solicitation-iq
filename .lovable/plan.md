## Issue

In the in-app report viewer (`ReportViewer.tsx`), several sections render blank: **Cover, At a Glance, Issue Category Legend, Quick Reference Index**. The PDF/Word exports of the same report look fine.

## Root cause

`BlocksRenderer` in `src/features/reports/components/ReportViewer.tsx` only has cases for 6 block kinds: `paragraph`, `bullets`, `kv`, `category`, `recommendation`, `steps`. The report content also uses 6 more kinds emitted by the generator and rendered by the PDF/Word exporters but missing from the viewer:

- `coverHero` → Cover section (blank)
- `statsStrip` → "At a Glance" tiles (blank)
- `categoryBand` → group headings inside Submitted Questions
- `categoryLegend` → Issue Category Legend (blank)
- `indexTable` → Quick Reference Index (blank)
- `questionCard` → individual Q&A cards inside Submitted Questions

Anything not matched falls through `default: return null`, so the section header renders but the body is empty.

## Fix

Extend the `switch` in `BlocksRenderer` to render the missing 6 kinds with simple, on-brand HTML/Tailwind that mirrors the PDF look. No data, schema, or generator changes — viewer-only.

### `src/features/reports/components/ReportViewer.tsx`

Add cases for:

1. **`coverHero`** — centered block: small amber eyebrow ("CLIENT STRATEGIC QUESTIONNAIRE"), big navy title, optional solicitation number + agency, italic "Generated …" date. Firm name as a top navy band with amber accent rule.

2. **`statsStrip`** — responsive grid (2 / 3 / 5 cols) of tiles: light grey value cell on top (large navy number), navy label cell underneath (small white uppercase label).

3. **`categoryBand`** — full-width grey band with a colored left bar matching the tone (use the same tone → color map as `category`), uppercase title + muted "(N questions)" count.

4. **`categoryLegend`** — 2-column grid of cards: colored left bar, dot + uppercase label + count, description text below.

5. **`indexTable`** — table with columns `#` / `Category` (colored pill) / `Source` / `Topic / Summary`, alt-row tinting, sticky-style navy header. Apply `softBreakWord` to source/topic so long ampersand-glued tokens wrap (same root cause as the prior PDF fix).

6. **`questionCard`** — card with amber left bar, "Q{n}" + category pill on the left rail, then question text, italic rationale, bold amber source line, italic agency response if present.

### Tone → color mapping

Add a small helper `toneClasses(tone)` returning `{ solid, tint, text }` Tailwind class strings keyed off the existing `CategoryTone` values used by the PDF (so `contradiction`, `clarification`, `drafting_error`, `risk_concern`, `opportunity`, `risk`, `neutral`, etc. all map to consistent colors). Reuse the existing inline color classes already used by the `category` case as a reference for navy/amber/green/red.

### Imports

Add `import { softBreakWord } from "../utils/textBreaks";` for the index table.

## Out of scope

- Generator / template / Word changes (those already render correctly).
- Restyling existing block kinds.
- Fixing the underlying garbled `&S&u&r&v…` source strings (data-quality issue, separate task).

## Verification

1. Open the same report (`/solicitations/1095001d-…?tab=reports` → View on the Strategic Questionnaire).
2. Confirm Cover, At a Glance, Issue Category Legend, and Quick Reference Index now render with content.
3. Confirm Submitted Questions shows category bands and per-question cards (Q1, Q2, …) with badges, rationales, sources.
4. PDF and Word exports continue to look unchanged.
