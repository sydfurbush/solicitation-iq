import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";

export type RequirementItem = Database["public"]["Tables"]["requirement_items"]["Row"];
export type RequirementUpdate = Database["public"]["Tables"]["requirement_items"]["Update"];

const key = (id: string) => ["requirement-items", id] as const;
const versionsKey = (reqId: string) => ["requirement-item-versions", reqId] as const;

export function useRequirementItems(solicitationId: string | undefined) {
  return useQuery({
    queryKey: solicitationId ? key(solicitationId) : ["requirement-items", "none"],
    enabled: !!solicitationId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("requirement_items")
        .select("*")
        .eq("solicitation_id", solicitationId!)
        .order("req_number", { ascending: true });
      if (error) throw error;
      return (data ?? []) as RequirementItem[];
    },
  });
}

export function useExtractRequirements(solicitationId: string | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { regenerate?: boolean } = {}) => {
      if (!solicitationId) throw new Error("Missing solicitationId");
      const { data, error } = await supabase.functions.invoke("extract-requirements", {
        body: { solicitationId, regenerate: input.regenerate ?? false },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      return data;
    },
    onSuccess: () => {
      if (!solicitationId) return;
      qc.invalidateQueries({ queryKey: key(solicitationId) });
    },
  });
}

export function useUpdateRequirement(solicitationId: string | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { id: string; patch: RequirementUpdate }) => {
      const { error } = await supabase
        .from("requirement_items")
        .update(input.patch)
        .eq("id", input.id);
      if (error) throw error;
    },
    onSuccess: (_d, vars) => {
      if (solicitationId) qc.invalidateQueries({ queryKey: key(solicitationId) });
      qc.invalidateQueries({ queryKey: versionsKey(vars.id) });
    },
  });
}

export function useBulkUpdateRequirements(solicitationId: string | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { ids: string[]; patch: RequirementUpdate }) => {
      if (!input.ids.length) return { count: 0 };
      const { error } = await supabase
        .from("requirement_items")
        .update(input.patch)
        .in("id", input.ids);
      if (error) throw error;
      return { count: input.ids.length };
    },
    onSuccess: () => {
      if (solicitationId) qc.invalidateQueries({ queryKey: key(solicitationId) });
    },
  });
}

export function useDeleteRequirement(solicitationId: string | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("requirement_items").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      if (!solicitationId) return;
      qc.invalidateQueries({ queryKey: key(solicitationId) });
    },
  });
}

export type RequirementVersion = {
  id: string;
  requirement_id: string;
  solicitation_id: string;
  snapshot: Record<string, unknown>;
  change_summary: string | null;
  changed_by: string | null;
  changed_at: string;
};

export function useRequirementVersions(requirementId: string | undefined) {
  return useQuery({
    queryKey: requirementId ? versionsKey(requirementId) : ["requirement-item-versions", "none"],
    enabled: !!requirementId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("requirement_item_versions" as never)
        .select("*")
        .eq("requirement_id", requirementId!)
        .order("changed_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as unknown as RequirementVersion[];
    },
  });
}

export function useRevertRequirement(solicitationId: string | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { requirementId: string; snapshot: Record<string, unknown> }) => {
      const allowed: (keyof RequirementUpdate)[] = [
        "shall_text",
        "compliance_owner",
        "proposal_volume",
        "proposal_section",
        "status",
        "notes",
        "source_section",
      ];
      const patch: RequirementUpdate = {};
      for (const k of allowed) {
        if (k in input.snapshot) {
          (patch as Record<string, unknown>)[k] = input.snapshot[k as string] ?? null;
        }
      }
      const { error } = await supabase
        .from("requirement_items")
        .update(patch)
        .eq("id", input.requirementId);
      if (error) throw error;
    },
    onSuccess: (_d, vars) => {
      if (solicitationId) qc.invalidateQueries({ queryKey: key(solicitationId) });
      qc.invalidateQueries({ queryKey: versionsKey(vars.requirementId) });
    },
  });
}
