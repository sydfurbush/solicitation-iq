export const EXECUTIVE_SUMMARY_PROMPT = `Generate a professional executive summary report. The report should be suitable for C-level executives. Include exactly these sections (use them as section headings):

1. Executive Overview — 1 paragraph: what is this opportunity, why it matters, our overall assessment.
2. Opportunity Snapshot — bullets: agency, solicitation #, contract type, value range, key dates, incumbent status.
3. Strategic Assessment — top 3 opportunities, top 3 risks (append "(Mitigated)" to any risk title where is_mitigated is true), competitive positioning summary (3 short paragraphs).
4. Recommendation — go/no-go with rationale, key success factors, immediate next steps as a numbered list.

Crisp, executive language. Use markdown formatting (bullets, bold). Cite supporting source material inline as [Doc Name §Section p.X] when referencing specific requirements.`;

export const FULL_ANALYSIS_PROMPT = `Generate a comprehensive solicitation analysis report. Use these sections as headings exactly:

1. Executive Summary
2. Solicitation Overview
3. Requirements Analysis
4. Evaluation Criteria Analysis
5. Risk Assessment
6. Opportunities Analysis
7. Competitive Landscape
8. Strategic Questions
9. Comparison to Prior Solicitation
10. Proposal Strategy Recommendations
11. Appendices

Be thorough and analytical. Every claim must include a citation in the form [Doc Name §Section p.X]. Use markdown (bullets, tables where useful, bold for emphasis). If "Comparison to Prior Solicitation" data is not available, briefly state none.`;

export const QUESTIONS_BRIEF_PROMPT = `Generate a Strategic Questions brief organized by recommendation:

1. Submitted Questions — questions with recommendation 'ask'. Format as numbered Q&A: each question with rationale.
2. Strategic Hold Questions — recommendation 'hold'. Explain the competitive advantage of holding.
3. Internal Discussion Items — recommendation 'monitor' or 'internal'. Brief summaries.

Use markdown. Include citations [Doc §Section p.X] for each question.`;

export const RISK_ASSESSMENT_PROMPT = `Generate a Risk Assessment report:

1. Risk Overview — summary of risk landscape, count by severity, and split counts as "Open" vs "Mitigated" (based on each risk's is_mitigated flag).
2. Critical Risks — each critical/high risk with description, source citation, current mitigation notes (mitigation_strategy), and a clear status label of "Open" or "Mitigated". When mitigated, summarize how the mitigation resolves the risk.
3. Mitigation Plan — prioritized action list for remaining Open risks only.

Use markdown. Cite sources as [Doc §Section p.X].`;

export const OPPORTUNITY_BRIEF_PROMPT = `Generate an Opportunity Brief:

1. Opportunity Overview — summary of identified competitive openings.
2. High-Impact Opportunities — each opportunity with description, recommended approach, capability match, citation.
3. Recommended Capture Approach — prioritized strategy.

Markdown formatting with citations.`;

export const COMPARISON_REPORT_PROMPT = `Generate a Comparison Report based on the supplied prior-solicitation comparison data:

1. Comparison Summary — overall narrative of changes.
2. Key Changes — categorized: requirements, evaluation factors, scope, timeline, financial.
3. Strategic Implications — what these changes signal for incumbent and competitors, with recommended response.

Use markdown. If no comparison data exists, state that clearly.`;

export const PROPOSAL_OUTLINE_PROMPT = `Generate a Proposal Outline tailored to this solicitation:

1. Volume Structure — recommended volumes (Technical, Management, Past Performance, Cost, etc.) with page-limit suggestions.
2. Section Outline — a section-by-section outline mapped to evaluation factors.
3. Compliance Matrix — markdown table: Requirement | Source [Doc §Section] | Volume/Section | Notes.
4. Win Themes — 3-5 themes with proof points.
5. Discriminators — 3-5 discriminators specific to this opportunity.
6. Key Personnel Requirements — list inferred from solicitation.
7. Past Performance Suggestions — what types of past performance to emphasize.

Use markdown with tables where helpful.`;

import type { ReportType } from "./types";

export const PROMPT_BY_TYPE: Record<ReportType, string> = {
  executive_summary: EXECUTIVE_SUMMARY_PROMPT,
  full_analysis: FULL_ANALYSIS_PROMPT,
  questions_brief: QUESTIONS_BRIEF_PROMPT,
  client_questionnaire: QUESTIONS_BRIEF_PROMPT,
  risk_assessment: RISK_ASSESSMENT_PROMPT,
  opportunity_brief: OPPORTUNITY_BRIEF_PROMPT,
  comparison_report: COMPARISON_REPORT_PROMPT,
  proposal_outline: PROPOSAL_OUTLINE_PROMPT,
};
