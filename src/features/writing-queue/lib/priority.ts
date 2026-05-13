/**
 * Deterministic priority scoring for proposal writing queue.
 * Higher score = start sooner.
 */
import type { Database } from "@/integrations/supabase/types";

type OutlineNode = Database["public"]["Tables"]["outline_nodes"]["Row"];
type CapabilityGap = Database["public"]["Tables"]["capability_gaps"]["Row"];
type SectionAnalysis = Database["public"]["Tables"]["section_analyses"]["Row"];

export interface PriorityInput {
  node: OutlineNode;
  gaps: CapabilityGap[];
  sections: SectionAnalysis[];
  proposalDueDate?: string | null;
}

export interface PriorityBreakdown {
  total: number;
  parts: { label: string; value: number }[];
}

export function computePriority(input: PriorityInput): PriorityBreakdown {
  const { node, gaps, sections, proposalDueDate } = input;
  const parts: { label: string; value: number }[] = [];

  // Section weight (best-effort match by source_l_reference or section_number)
  const matchKey = (node.source_l_reference || node.section_number || "").toLowerCase();
  const matchedSection = sections.find(
    (s) =>
      matchKey &&
      (matchKey.includes(s.section_code.toLowerCase()) ||
        s.section_code.toLowerCase().includes(matchKey)),
  );
  const weight = matchedSection?.scoring_weight ?? 0;
  if (weight) parts.push({ label: "Section weight", value: Number((weight * 0.5).toFixed(1)) });

  // Page allocation
  const pages = node.page_allocation ?? 0;
  if (pages) parts.push({ label: `Pages (${pages})`, value: pages * 2 });

  // Linked requirement count
  const reqCount = node.linked_requirement_ids?.length ?? 0;
  if (reqCount) parts.push({ label: `Reqs (${reqCount})`, value: Number((reqCount * 1.5).toFixed(1)) });

  // Critical/high gaps tied to linked requirements
  const linkedReqIds = new Set(node.linked_requirement_ids ?? []);
  const criticalCount = gaps.filter(
    (g) => g.requirement_id && linkedReqIds.has(g.requirement_id) && !g.is_resolved && (g.severity === "critical" || g.severity === "high"),
  ).length;
  if (criticalCount) parts.push({ label: `Critical gaps (${criticalCount})`, value: criticalCount * 10 });

  // Due-soon bonus
  if (proposalDueDate) {
    const days = Math.ceil((new Date(proposalDueDate).getTime() - Date.now()) / 86400000);
    if (days <= 7 && days >= 0) parts.push({ label: "Due ≤7d", value: 8 });
    else if (days <= 14 && days >= 0) parts.push({ label: "Due ≤14d", value: 4 });
  }

  // Status nudge — already-final sections drop to bottom
  if (node.writing_status === "final") parts.push({ label: "Final", value: -100 });
  else if (node.writing_status === "red_ready") parts.push({ label: "Red ready", value: -20 });
  else if (node.writing_status === "pink_ready") parts.push({ label: "Pink ready", value: -10 });

  const total = parts.reduce((acc, p) => acc + p.value, 0);
  return { total: Number(total.toFixed(1)), parts };
}

export function priorityTone(score: number): "high" | "medium" | "low" {
  if (score >= 25) return "high";
  if (score >= 10) return "medium";
  return "low";
}
