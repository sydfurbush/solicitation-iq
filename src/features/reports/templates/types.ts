import type { Block } from "./blocks";

export type ReportType =
  | "executive_summary"
  | "full_analysis"
  | "questions_brief"
  | "client_questionnaire"
  | "risk_assessment"
  | "opportunity_brief"
  | "comparison_report"
  | "proposal_outline";

export type ReportSection = {
  id: string;
  heading: string;
  body?: string; // markdown allowed (legacy / fallback)
  blocks?: Block[]; // preferred — structured rendering
  level?: 1 | 2 | 3;
};

export type ReportContent = {
  title: string;
  subtitle?: string;
  generatedAt: string;
  meta?: Record<string, string | number | null | undefined>;
  sections: ReportSection[];
  citations?: Array<{ id: string; document: string; section?: string; page?: number; quote?: string }>;
  branding?: ReportOptions["branding"];
};

export type ReportOptions = {
  includeCitations?: boolean;
  includeRecommendations?: boolean;
  sectionsToInclude?: string[];
  branding?: {
    primaryColor?: string;
    clientLogoUrl?: string;
    firmLogoUrl?: string;
    headerText?: string;
    footerText?: string;
  };
  outputFormat?: "pdf" | "docx" | "both" | "none";
};

export const REPORT_TYPES: Array<{
  id: ReportType;
  title: string;
  description: string;
  estimatedTime: string;
  defaultSections: string[];
}> = [
  {
    id: "executive_summary",
    title: "Executive Summary",
    description: "High-level overview for executives. 2-3 pages.",
    estimatedTime: "30 sec",
    defaultSections: ["Executive Overview", "Opportunity Snapshot", "Strategic Assessment", "Recommendation"],
  },
  {
    id: "full_analysis",
    title: "Full Analysis",
    description: "Comprehensive analysis with all sections and citations. 15-25 pages.",
    estimatedTime: "1-2 min",
    defaultSections: ["Executive Summary", "Solicitation Overview", "Requirements Analysis", "Evaluation Criteria", "Risks", "Opportunities", "Strategic Questions", "Proposal Strategy"],
  },
  {
    id: "questions_brief",
    title: "Strategic Questions Brief",
    description: "Submission-ready Q&A document for the agency.",
    estimatedTime: "20 sec",
    defaultSections: ["Submitted Questions", "Strategic Hold Questions", "Internal Discussion Items"],
  },
  {
    id: "client_questionnaire",
    title: "Client Strategic Questionnaire",
    description: "Client-ready deliverable: cover, executive summary, category legend, quick-reference index, and full Q&A detail.",
    estimatedTime: "25 sec",
    defaultSections: ["Cover", "At a Glance", "Executive Summary", "Issue Category Legend", "Quick Reference Index", "Submitted Questions", "Strategic Hold Questions", "Internal Discussion Items"],
  },
  {
    id: "risk_assessment",
    title: "Risk Assessment",
    description: "Risk-focused report with mitigations.",
    estimatedTime: "30 sec",
    defaultSections: ["Risk Overview", "Critical Risks", "Mitigation Plan"],
  },
  {
    id: "opportunity_brief",
    title: "Opportunity Brief",
    description: "Opportunities and recommended approaches.",
    estimatedTime: "30 sec",
    defaultSections: ["Opportunity Overview", "High-Impact Opportunities", "Recommended Capture Approach"],
  },
  {
    id: "comparison_report",
    title: "Comparison Report",
    description: "Differences from prior solicitation.",
    estimatedTime: "30 sec",
    defaultSections: ["Comparison Summary", "Key Changes", "Strategic Implications"],
  },
  {
    id: "proposal_outline",
    title: "Proposal Outline",
    description: "Suggested proposal volume structure and themes.",
    estimatedTime: "45 sec",
    defaultSections: ["Volume Structure", "Section Outline", "Compliance Matrix", "Win Themes", "Discriminators"],
  },
];

export const REPORT_TYPE_BY_ID = Object.fromEntries(REPORT_TYPES.map((r) => [r.id, r])) as Record<ReportType, (typeof REPORT_TYPES)[number]>;
