## Goal
Add four new report deliverables that close gaps against existing data. Use deterministic PDFs where the source is structured tables, AI narrative where prose adds value.

## Reports to add

### 1. Compliance Matrix + RTM (deterministic, per solicitation)
Two PDFs sharing the same data source:
- **Compliance Matrix** — `requirement_items` joined to `outline_nodes` (where mapped). Columns: ID · Requirement (truncated + source citation) · Type (shall/must/should) · Volume/Section · Owner · Status · Notes. Grouped by source document, sorted by section/page.
- **RTM** — stricter variant of the same data. Every requirement listed once with: Requirement ID · Source (doc §section p.X) · Verb · Response location · Compliance status (`compliant`/`partial`/`gap`/`tbd`) · Verification method.

Wired from the existing solicitation Reports tab and from the `Phase 3 → Compliance` step.

### 2. Cost-to-Bid / Time & Utilization (deterministic, per solicitation)
PDF that aggregates `time_entries` × `user_rates` for one solicitation:
- KPI strip: total hours · billable hours · cost-to-bid · vs. estimated value (gross margin if won).
- By person table: name · hours · billable · blended rate · cost.
- By phase table: phase · hours · cost · % of total.
- Daily activity sparkline-style table (last 60 days).
- Footer note about which rate snapshots were applied.

Mounts on `SolicitationDetail` next to the existing report list, and on `/reports → Operations` as a per-solicitation export.

### 3. Win/Loss Analysis (AI narrative, org-wide) + Past Performance Brief (deterministic, org-wide)
- **Win/Loss Analysis** — pulls all `solicitation_outcomes` in a date range. AI summarizes themes per outcome bucket, drawing on the linked solicitations' `ai_summary`, evaluation factors, and outcome notes. Sections: Overview · Win patterns · Loss patterns · No-bid rationale · Recommendations. Filterable by client and date range.
- **Past Performance Brief** — deterministic. One block per `won` outcome: client · solicitation · awarded value · period of performance · scope summary (from `ai_summary` or title) · contact placeholder. Formatted as a reusable "Past Performance" reference document.

Both surface under `/reports` as a new **"Org reports"** tab (alongside Operations / Deliverables / Client Portfolio).

### 4. Teaming + Win Themes + Capability Gaps briefs (deterministic, per solicitation)
Three small standalone PDFs, each rendered with `pdfKit` + the existing `drawTable`/`writeWrapped` helpers:
- **Teaming Brief** — table of `solicitation_teaming_partners` with capabilities, role, NAICS, status, attachments listed.
- **Win Themes Brief** — `win_themes` rows with theme · proof points · supporting citations · discriminator flag.
- **Capability Gaps Brief** — `capability_gaps` rows with requirement · gap description · severity · proposed remediation · owner.

Wired into existing tab pages: each tab gains a "Download PDF" button using `PdfToolsMenu`.

## Technical layout

- `src/features/reports/pdf/complianceMatrix.ts` + `rtm.ts`
- `src/features/reports/pdf/costToBid.ts`
- `src/features/reports/pdf/pastPerformance.ts`
- `src/features/reports/pdf/teamingBrief.ts`, `winThemesBrief.ts`, `capabilityGapsBrief.ts`
- `supabase/functions/generate-win-loss-analysis/index.ts` (AI; deterministic path falls back when no rows)
- `src/features/reports-hub/components/OrgReportsTab.tsx` — new tab on `/reports` for win/loss + past performance
- `REPORT_TYPES` registry gains: `compliance_matrix`, `rtm`, `cost_to_bid`, `teaming_brief`, `win_themes_brief`, `capability_gaps_brief`, `past_performance`, `win_loss_analysis`. The first six register as per-solicitation deterministic generators (no edge function call); `win_loss_analysis` calls the new edge function; `past_performance` is org-wide deterministic.
- `ReportTypeSelector` gets new icons and handles the deterministic path by invoking the generator directly instead of inserting an `executive_reports` row.

## Out of scope (v1)
- Editable templates / branding per report (uses existing branding options).
- Storing deterministic reports in `executive_reports` — they download directly; we can persist later if needed.
- Approval/sign-off workflow on RTM rows (status column is display-only for now).
- Lessons-learned post-mortem, pipeline forecast, per-solicitation client status brief — deferred to a follow-up.

## Open question
The deterministic per-solicitation PDFs (compliance matrix, RTM, cost-to-bid, the three small briefs) currently bypass `executive_reports` and download on click. If you want them to also show up in the **Deliverables Library** tab, we'd need to make `solicitation_id` nullable or add a `client_id` column to `executive_reports`, and persist a row each time. Let me know — happy to do it; just adds a migration.