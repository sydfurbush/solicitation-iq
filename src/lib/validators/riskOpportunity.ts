import { z } from "zod";

export const RISK_SEVERITIES = ["critical", "high", "medium", "low", "informational"] as const;
export const OPPORTUNITY_TYPES = [
  "innovation",
  "cost_reduction",
  "scope_expansion",
  "efficiency",
  "differentiation",
  "incumbent_weakness",
  "evaluation_advantage",
] as const;

export const riskSchema = z.object({
  title: z.string().min(3, "Title is required").max(200),
  description: z.string().min(5, "Description is required").max(2000),
  severity: z.enum(RISK_SEVERITIES),
  source_document_id: z.string().uuid().nullable().optional(),
  source_citation: z.string().max(200).nullable().optional(),
  source_quote: z.string().max(1000).nullable().optional(),
  mitigation_strategy: z.string().max(2000).nullable().optional(),
});

export type RiskFormValues = z.infer<typeof riskSchema>;

export const opportunitySchema = z.object({
  title: z.string().min(3, "Title is required").max(200),
  description: z.string().min(5, "Description is required").max(2000),
  opportunity_type: z.enum(OPPORTUNITY_TYPES),
  impact_score: z.number().min(1).max(100),
  source_document_id: z.string().uuid().nullable().optional(),
  source_citation: z.string().max(200).nullable().optional(),
  source_quote: z.string().max(1000).nullable().optional(),
  recommended_approach: z.string().max(2000).nullable().optional(),
  client_capability_match: z.string().max(2000).nullable().optional(),
});

export type OpportunityFormValues = z.infer<typeof opportunitySchema>;
