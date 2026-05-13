import { useMemo } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";
import { useActiveOutline, useOutlineNodes } from "@/features/outline/hooks/useProposalOutline";
import { useRequirementItems } from "@/features/deepdive/hooks/useRequirementItems";
import { useCapabilityGaps } from "@/features/deepdive/hooks/useCapabilityGaps";
import { useSectionAnalyses } from "@/features/deepdive/hooks/useSectionAnalyses";
import { useWinThemes } from "@/features/winthemes/hooks/useWinThemes";
import { useSolicitation } from "@/features/solicitations/hooks/useSolicitations";
import { computePriority, type PriorityBreakdown } from "../lib/priority";

type OutlineNode = Database["public"]["Tables"]["outline_nodes"]["Row"];
type OutlineNodeUpdate = Database["public"]["Tables"]["outline_nodes"]["Update"];
type RequirementItem = Database["public"]["Tables"]["requirement_items"]["Row"];
type WinTheme = Database["public"]["Tables"]["win_themes"]["Row"];

export interface WritingQueueRow {
  node: OutlineNode;
  priority: PriorityBreakdown;
  linkedRequirements: RequirementItem[];
  themes: WinTheme[];
  criticalGapCount: number;
}

export function useWritingQueue(solicitationId: string | undefined) {
  const { data: solicitation } = useSolicitation(solicitationId);
  const { data: outline } = useActiveOutline(solicitationId);
  const { data: nodes = [], isLoading: nodesLoading } = useOutlineNodes(outline?.id);
  const { data: requirements = [] } = useRequirementItems(solicitationId);
  const { data: gaps = [] } = useCapabilityGaps(solicitationId);
  const { data: sections = [] } = useSectionAnalyses(solicitationId);
  const { data: themes = [] } = useWinThemes(solicitationId);

  const dueDate = (solicitation as { proposal_due_date?: string | null } | undefined)?.proposal_due_date ?? null;

  const rows: WritingQueueRow[] = useMemo(() => {
    const reqMap = new Map(requirements.map((r) => [r.id, r]));
    return nodes.map((node) => {
      const linkedRequirements = (node.linked_requirement_ids ?? [])
        .map((id) => reqMap.get(id))
        .filter((r): r is RequirementItem => !!r);
      const linkedReqIds = new Set(node.linked_requirement_ids ?? []);
      const matchingThemes = themes.filter(
        (t) => (t.linked_outline_node_ids ?? []).includes(node.id),
      );
      const criticalGapCount = gaps.filter(
        (g) =>
          g.requirement_id &&
          linkedReqIds.has(g.requirement_id) &&
          !g.is_resolved &&
          (g.severity === "critical" || g.severity === "high"),
      ).length;
      return {
        node,
        priority: computePriority({ node, gaps, sections, proposalDueDate: dueDate }),
        linkedRequirements,
        themes: matchingThemes,
        criticalGapCount,
      };
    });
  }, [nodes, requirements, gaps, sections, themes, dueDate]);

  return {
    outline,
    rows,
    isLoading: nodesLoading,
  };
}

export function useUpdateOutlineNodeFields(outlineId: string | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { id: string; patch: OutlineNodeUpdate }) => {
      const { error } = await supabase
        .from("outline_nodes")
        .update(input.patch)
        .eq("id", input.id);
      if (error) throw error;
    },
    onSuccess: () => {
      if (outlineId) qc.invalidateQueries({ queryKey: ["outline-nodes", outlineId] });
    },
  });
}
