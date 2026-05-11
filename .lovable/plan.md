# One-Page Sales Sheet (PDF) — Solicitation IQ

## Goal
Produce a single-page, design-forward PDF sales sheet that a sales rep can email or hand to a prospect. Saved to `/mnt/documents/solicitation-iq-sales-sheet.pdf`.

## Layout (single US Letter page, portrait)

```
┌─────────────────────────────────────────────────┐
│  SOLICITATION IQ            [tagline / mark]    │  ← Header band (dark navy)
├─────────────────────────────────────────────────┤
│  HERO LINE                                      │
│  "Win more government work in a fraction of     │
│   the time."                                    │
│  1-sentence positioning                         │
├──────────────────┬──────────────────────────────┤
│ TIME SAVINGS     │  COST REDUCTION              │
│ • 200pg RFP:     │  • ~$3K saved per pursuit    │
│   8–16h → 5–10m  │  • Faster no-bid decisions   │
│ • SAM import: 1c │  • Per-user API keys         │
│ • Q&A: hrs → min │                              │
├──────────────────┼──────────────────────────────┤
│ RISK REDUCTION   │  EVALUATION & COMPARISON     │
│ • AI compliance  │  • Bid/no-bid scoring        │
│ • Amendment diff │  • Prior-solicitation diff   │
│ • Audit trail    │  • Citations on every claim  │
│ • RLS isolation  │  • Incumbent intel           │
├──────────────────┴──────────────────────────────┤
│  SAMPLE WORKFLOW (5 steps, horizontal)          │
│  1 Import → 2 Analyze → 3 Compare → 4 Generate  │
│    Questions → 5 Export Client Report           │
├─────────────────────────────────────────────────┤
│  ROI CALLOUT (large stat)                       │
│  ~$70K/yr returned for a 30-pursuit firm        │
├─────────────────────────────────────────────────┤
│  Footer: contact / URL / "Book a demo"          │
└─────────────────────────────────────────────────┘
```

## Design direction
- Palette: deep navy primary (#0F172A), slate accents, single warm accent (amber #F59E0B) for stat callouts. Clean, executive — matches the existing app's serious GovCon tone.
- Typography: Inter/Helvetica family (already used in PDF generator). Big bold numbers for stats, small caps for section labels.
- Heavy use of icon + label + 2-line description blocks (no long paragraphs).
- One large ROI stat block as the visual anchor.
- Footer with placeholder contact (user can edit later).

## Build approach
- Python + ReportLab (already used in `src/features/reports/utils/pdfGenerator.ts` patterns; ReportLab is the server-side equivalent here).
- Single script in `/tmp/`, output to `/mnt/documents/solicitation-iq-sales-sheet.pdf`.
- Visual QA: render to JPG with `pdftoppm`, inspect, fix overflow/contrast/alignment, re-render until clean.

## Open questions (will use sensible defaults if not answered)
- Company / contact info to show in the footer? (Default: "solicitation-iq.lovable.app · Book a demo")
- Logo file to embed? (Default: typographic wordmark only)

## Deliverable
A single `<lov-artifact>` link to the finished PDF.
