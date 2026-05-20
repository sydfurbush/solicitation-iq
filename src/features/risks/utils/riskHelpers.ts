import type { Database } from "@/integrations/supabase/types";

export type RiskSeverity = Database["public"]["Enums"]["risk_severity"];
export type OpportunityType = Database["public"]["Enums"]["opportunity_type"];

export const SEVERITY_LABEL: Record<RiskSeverity, string> = {
  critical: "Critical",
  high: "High",
  medium: "Medium",
  low: "Low",
  informational: "Informational",
};

export const SEVERITY_ORDER: RiskSeverity[] = [
  "critical",
  "high",
  "medium",
  "low",
  "informational",
];

export function severityRank(s: RiskSeverity | null | undefined) {
  return SEVERITY_ORDER.indexOf((s ?? "medium") as RiskSeverity);
}

export const SEVERITY_BADGE: Record<RiskSeverity, string> = {
  critical: "bg-red-600 text-white border-red-700 animate-pulse",
  high: "bg-red-500 text-white border-red-600",
  medium: "bg-amber-500 text-white border-amber-600",
  low: "bg-yellow-500 text-foreground border-yellow-600",
  informational: "bg-blue-500 text-white border-blue-600",
};

export const SEVERITY_DOT: Record<RiskSeverity, string> = {
  critical: "bg-red-600",
  high: "bg-red-500",
  medium: "bg-amber-500",
  low: "bg-yellow-500",
  informational: "bg-blue-500",
};

export const STATUS_PILL_OPEN =
  "border-amber-500/40 bg-amber-500/10 text-amber-700 dark:text-amber-300";
export const STATUS_PILL_MITIGATED =
  "border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300";
export const STATUS_STRIPE_OPEN = "border-l-4 border-l-amber-500";
export const STATUS_STRIPE_MITIGATED = "border-l-4 border-l-emerald-500 opacity-75";

export const OPPORTUNITY_LABEL: Record<OpportunityType, string> = {
  innovation: "Innovation",
  cost_reduction: "Cost Reduction",
  scope_expansion: "Scope Expansion",
  efficiency: "Efficiency",
  differentiation: "Differentiation",
  incumbent_weakness: "Incumbent Weakness",
  evaluation_advantage: "Evaluation Advantage",
};

export const OPPORTUNITY_BADGE: Record<OpportunityType, string> = {
  innovation: "bg-purple-500/15 text-purple-700 dark:text-purple-300 border-purple-500/30",
  cost_reduction: "bg-green-500/15 text-green-700 dark:text-green-300 border-green-500/30",
  scope_expansion: "bg-blue-500/15 text-blue-700 dark:text-blue-300 border-blue-500/30",
  efficiency: "bg-teal-500/15 text-teal-700 dark:text-teal-300 border-teal-500/30",
  differentiation: "bg-indigo-500/15 text-indigo-700 dark:text-indigo-300 border-indigo-500/30",
  incumbent_weakness: "bg-orange-500/15 text-orange-700 dark:text-orange-300 border-orange-500/30",
  evaluation_advantage: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30",
};

export function impactLevel(score: number | null | undefined): "high" | "medium" | "low" {
  const s = score ?? 0;
  if (s >= 70) return "high";
  if (s >= 40) return "medium";
  return "low";
}
