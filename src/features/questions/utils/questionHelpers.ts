import type { Database } from "@/integrations/supabase/types";

export type QuestionRow = Database["public"]["Tables"]["strategic_questions"]["Row"];
export type QuestionCategory = Database["public"]["Enums"]["question_category"];
export type QuestionRecommendation = Database["public"]["Enums"]["question_recommendation"];

export const CATEGORIES: QuestionCategory[] = [
  "clarification",
  "strategic",
  "scope_expansion",
  "risk_concern",
  "compliance",
  "other",
];

export const RECOMMENDATIONS: QuestionRecommendation[] = ["ask", "hold", "monitor", "internal_only"];

export const CATEGORY_LABEL: Record<QuestionCategory, string> = {
  clarification: "Clarification",
  strategic: "Strategic",
  scope_expansion: "Scope Expansion",
  risk_concern: "Risk / Concern",
  compliance: "Compliance",
  other: "Other",
};

export const RECOMMENDATION_LABEL: Record<QuestionRecommendation, string> = {
  ask: "Submit",
  hold: "Hold",
  monitor: "Monitor",
  internal_only: "Internal",
};

export function getCategoryColor(c: QuestionCategory): string {
  switch (c) {
    case "clarification": return "bg-blue-500/15 text-blue-700 dark:text-blue-400 border-blue-500/30";
    case "strategic": return "bg-purple-500/15 text-purple-700 dark:text-purple-400 border-purple-500/30";
    case "scope_expansion": return "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-500/30";
    case "risk_concern": return "bg-destructive/15 text-destructive border-destructive/30";
    case "compliance": return "bg-amber-500/15 text-amber-700 dark:text-amber-400 border-amber-500/30";
    case "other": return "bg-muted text-muted-foreground border-border";
  }
}

export function getRecommendationColor(r: QuestionRecommendation): string {
  switch (r) {
    case "ask": return "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-500/30";
    case "hold": return "bg-amber-500/15 text-amber-700 dark:text-amber-400 border-amber-500/30";
    case "monitor": return "bg-muted text-muted-foreground border-border";
    case "internal_only": return "bg-slate-500/15 text-slate-700 dark:text-slate-300 border-slate-500/30";
  }
}

export type PriorityLevel = "high" | "medium" | "low";

export function getPriorityLevel(score: number | null | undefined): PriorityLevel {
  const s = score ?? 0;
  if (s >= 70) return "high";
  if (s >= 40) return "medium";
  return "low";
}

export interface QuestionFilters {
  search?: string;
  categories?: QuestionCategory[];
  recommendations?: QuestionRecommendation[];
  priorities?: PriorityLevel[];
  submitted?: "all" | "submitted" | "not_submitted";
  source?: "all" | "ai" | "manual";
}

export function filterQuestions(qs: QuestionRow[], f: QuestionFilters): QuestionRow[] {
  return qs.filter((q) => {
    if (f.search) {
      const t = f.search.toLowerCase();
      if (!q.question_text.toLowerCase().includes(t) && !(q.question_rationale ?? "").toLowerCase().includes(t)) return false;
    }
    if (f.categories?.length && !f.categories.includes(q.category)) return false;
    if (f.recommendations?.length && q.recommendation && !f.recommendations.includes(q.recommendation)) return false;
    if (f.priorities?.length && !f.priorities.includes(getPriorityLevel(q.priority))) return false;
    if (f.submitted === "submitted" && !q.is_submitted) return false;
    if (f.submitted === "not_submitted" && q.is_submitted) return false;
    if (f.source === "ai" && !q.is_ai_generated) return false;
    if (f.source === "manual" && q.is_ai_generated) return false;
    return true;
  });
}

export function sortQuestions(qs: QuestionRow[], by: "priority" | "recent" | "category" = "priority"): QuestionRow[] {
  const arr = [...qs];
  if (by === "priority") arr.sort((a, b) => (b.priority ?? 0) - (a.priority ?? 0));
  else if (by === "recent") arr.sort((a, b) => new Date(b.created_at ?? 0).getTime() - new Date(a.created_at ?? 0).getTime());
  else if (by === "category") arr.sort((a, b) => a.category.localeCompare(b.category));
  return arr;
}

export function formatQuestionForExport(q: QuestionRow): Record<string, string> {
  return {
    Question: q.question_text,
    Category: CATEGORY_LABEL[q.category],
    Recommendation: q.recommendation ? RECOMMENDATION_LABEL[q.recommendation] : "",
    Priority: String(q.priority ?? ""),
    Rationale: q.question_rationale ?? "",
    "Source Citation": q.source_citation ?? "",
    "Source Quote": q.source_quote ?? "",
    "Strategic Notes": q.strategic_advantage_notes ?? "",
    Submitted: q.is_submitted ? "Yes" : "No",
    "Agency Response": q.agency_response ?? "",
  };
}

export function questionsToCsv(qs: QuestionRow[]): string {
  if (qs.length === 0) return "";
  const rows = qs.map(formatQuestionForExport);
  const headers = Object.keys(rows[0]);
  const escape = (v: string) => `"${(v ?? "").replace(/"/g, '""')}"`;
  return [headers.join(","), ...rows.map((r) => headers.map((h) => escape(r[h])).join(","))].join("\n");
}
