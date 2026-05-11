import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";

export type RequirementItem = Database["public"]["Tables"]["requirement_items"]["Row"];
export type RequirementUpdate = Database["public"]["Tables"]["requirement_items"]["Update"];

const key = (id: string) => ["requirement-items", id] as const;

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
    onSuccess: () => {
      if (!solicitationId) return;
      qc.invalidateQueries({ queryKey: key(solicitationId) });
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
