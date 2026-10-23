import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useUser } from "@/features/auth/hooks/useUser";

/** Owners, admins and analysts may link requirements to outline sections. */
export function canEditRequirementLinks(role: string | null | undefined): boolean {
  return role === "owner" || role === "admin" || role === "analyst";
}

export function useCanEditRequirementLinks() {
  const { role } = useUser();
  return canEditRequirementLinks(role);
}

export function useAssignRequirement() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { requirementId: string; nodeId: string }) => {
      const { error } = await supabase.rpc("assign_requirement_to_section", {
        p_requirement_id: input.requirementId,
        p_outline_node_id: input.nodeId,
      });
      if (error) throw new Error(error.message);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["outline-nodes"] }),
  });
}

export function useUnassignRequirement() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { requirementId: string; outlineId: string }) => {
      const { error } = await supabase.rpc("unassign_requirement", {
        p_requirement_id: input.requirementId,
        p_outline_id: input.outlineId,
      });
      if (error) throw new Error(error.message);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["outline-nodes"] }),
  });
}
