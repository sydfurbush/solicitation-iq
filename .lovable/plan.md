# Plan: Enhance "Full Analysis" report with Competitive Position + Mitigation/Action Plans

## Goal
Make the **Full Analysis** report the single deliverable that surfaces the same Risk & Opportunity intelligence the in-app dashboard shows — including the win-probability indicator, strengths/weaknesses, prioritized mitigation plan, and impact-ranked opportunity action plan.

## Scope
Prompt-only change. No new report type, no schema or edge-function changes. Existing data already passed to `generate-report` (risks with `severity` / `is_mitigated` / `mitigation_strategy`, opportunities with `impact_score` / `recommended_approach` / `client_capability_match`) is sufficient — we just instruct the model to render it.

## Changes

**File:** `src/features/reports/templates/prompts.ts`

Update `FULL_ANALYSIS_PROMPT` so the three relevant sections are expanded with explicit subsections:

- **Section 5. Risk Assessment** — add:
  - Risk landscape table (count by severity, Open vs Mitigated split)
  - Critical/high risk detail with citation + current mitigation note + status
  - **Risk Mitigation Plan** subsection: prioritized action list for remaining Open risks (owner-ready language, ordered by severity)

- **Section 6. Opportunities Analysis** — add:
  - High-impact opportunities ranked by `impact_score`
  - **Opportunity Action Plan** subsection: top 5 opportunities as a numbered list with `recommended_approach` and `client_capability_match`

- **Section 7. Competitive Landscape** — add **Competitive Position Summary** subsection:
  - Win-probability indicator (qualitative band: Strong / Balanced / Reassess) derived from average opportunity impact minus unmitigated risk severity
  - Strengths (top 3 opportunities by impact)
  - Weaknesses (top 3 unmitigated risks by severity)
  - Recommended positioning (1 short paragraph)

All claims continue to require `[Doc §Section p.X]` citations.

## Out of scope
- No changes to `Executive Summary`, `Risk Assessment`, or `Opportunity Brief` prompts.
- No UI changes to `ReportTypeSelector` — Full Analysis remains labeled as today.
- No new database fields. The win-probability band is described qualitatively by the model from existing data, not computed numerically.

## Verification
After the change, generate a Full Analysis report on the current solicitation (`b4b67f93-...`) and confirm sections 5–7 contain the new subsections with citations.
