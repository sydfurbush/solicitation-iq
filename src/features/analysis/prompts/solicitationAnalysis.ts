// Reference prompt template used server-side. Kept here for documentation
// and so product can iterate on prompt copy in the frontend codebase.

export const SOLICITATION_ANALYSIS_SYSTEM_PROMPT = `You are an expert government contracting analyst with 20+ years of experience reviewing federal RFPs, RFQs, and IDIQ solicitations. Your job is to extract strategic intelligence that helps a contractor decide whether to bid and how to win.

You will receive excerpts from one or more solicitation documents and must produce a single JSON object that strictly matches the provided schema. Always:
- Cite EXACT sections (e.g. "L.5.2") and page numbers when available.
- Quote source text verbatim in the "quote" field (max 280 chars).
- Use priority levels: critical (must comply or no-bid), high, medium, low.
- Return at most 10 key requirements, ranked by importance.
- If a field cannot be determined from the documents, use null or an empty array.
- Confidence score is 0.0-1.0 reflecting how complete the source material is.

Output ONLY the JSON object, no prose.`;

export interface AnalysisRequirement {
  id: string;
  text: string;
  priority: "critical" | "high" | "medium" | "low";
  category: "technical" | "management" | "staffing" | "compliance" | "other";
  source?: {
    document?: string;
    section?: string;
    page?: number;
    quote?: string;
  };
  compliance_status?: "met" | "partial" | "not_met" | "unknown";
}

export interface AnalysisEvaluationFactor {
  name: string;
  weight?: number;
  description?: string;
  subfactors?: string[];
  source?: {
    document?: string;
    section?: string;
    page?: number;
    quote?: string;
  };
}

export interface IncumbentInfo {
  detected?: boolean;
  name?: string;
  contract_number?: string;
  indicators?: string[];
}

export interface ContractStructure {
  type?: string;
  base_period?: string;
  option_periods?: string;
  ceiling_value?: string;
  clins_detected?: boolean;
  pricing_structure?: string;
}

export interface SolicitationAnalysisResult {
  executive_summary: string;
  key_requirements: AnalysisRequirement[];
  evaluation_factors: AnalysisEvaluationFactor[];
  incumbent_info?: IncumbentInfo;
  contract_structure?: ContractStructure;
  risk_signals?: string[];
  opportunity_signals?: string[];
  confidence_score: number;
}

export interface AnalysisMetadata {
  last_analyzed_at: string;
  analysis_type: "full" | "incremental";
  document_ids: string[];
  contract_structure?: ContractStructure | null;
  incumbent_info?: IncumbentInfo;
  risk_signals?: string[];
  opportunity_signals?: string[];
}
