import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";

export type CapabilityGap = Database["public"]["Tables"]["capability_gaps"]["Row"];
export type CapabilityGapUpdate = Database["public"]["Tables"]["capability_gaps"]["Update"];

const key = (id: string) => ["capability-gaps", id] as const;

export function useCapabilityGaps(solicitationId: string | undefined) {
  return useQuery({
    queryKey: solicitationId ? key(solicitationId) : ["capability-gaps", "none"],
    enabled: !!solicitationId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("capability_gaps")
        .select("*")
        .eq("solicitation_id", solicitationId!)
        .order("severity", { ascending: false });
      if (error) throw error;
      return (data ?? []) as CapabilityGap[];
    },
  });
}

export function useAnalyzeGaps(solicitationId: string | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      if (!solicitationId) throw new Error("Missing solicitationId");
      const { data, error } = await supabase.functions.invoke("analyze-gaps", {
        body: { solicitationId },
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

export function useUpdateGap(solicitationId: string | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { id: string; patch: CapabilityGapUpdate }) => {
      const { error } = await supabase
        .from("capability_gaps")
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
