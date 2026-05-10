import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export function useRunComparison(solicitationId: string | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { priorSolicitationId?: string | null; priorRecordId?: string | null }) => {
      if (!solicitationId) throw new Error("Missing solicitationId");
      const { data, error } = await supabase.functions.invoke("compare-solicitations", {
        body: {
          currentSolicitationId: solicitationId,
          priorSolicitationId: input.priorSolicitationId ?? null,
          priorRecordId: input.priorRecordId ?? null,
        },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      return data;
    },
    onSuccess: () => {
      if (solicitationId) {
        qc.invalidateQueries({ queryKey: ["prior-solicitation", solicitationId] });
      }
    },
  });
}

export function useComparisonStatus(solicitationId: string | undefined, enabled: boolean) {
  return useQuery({
    queryKey: ["comparison-status", solicitationId],
    enabled: !!solicitationId && enabled,
    refetchInterval: enabled ? 3000 : false,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("prior_solicitations")
        .select("id, comparison_completed_at, changes_identified")
        .eq("solicitation_id", solicitationId!)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return {
        completed: !!data?.comparison_completed_at,
        hasChanges: !!data?.changes_identified,
      };
    },
  });
}
