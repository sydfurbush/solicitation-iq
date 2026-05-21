import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { ComparisonChanges } from "./usePriorSolicitation";

export type ComparisonRun = {
  id: string;
  prior_solicitation_id: string;
  solicitation_id: string;
  run_number: number;
  summary: string | null;
  changes_identified: ComparisonChanges | null;
  label: string | null;
  created_by: string | null;
  created_at: string;
};

const listKey = (priorId: string) => ["comparison-runs", priorId] as const;

export function useComparisonRuns(priorSolicitationRecordId: string | undefined) {
  return useQuery({
    queryKey: priorSolicitationRecordId ? listKey(priorSolicitationRecordId) : ["comparison-runs", "none"],
    enabled: !!priorSolicitationRecordId,
    queryFn: async (): Promise<ComparisonRun[]> => {
      const { data, error } = await supabase
        .from("comparison_runs")
        .select("*")
        .eq("prior_solicitation_id", priorSolicitationRecordId!)
        .order("run_number", { ascending: false });
      if (error) throw error;
      return (data ?? []) as unknown as ComparisonRun[];
    },
  });
}

export function useUpdateRunLabel(priorSolicitationRecordId: string | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { runId: string; label: string | null }) => {
      const { error } = await supabase
        .from("comparison_runs")
        .update({ label: input.label })
        .eq("id", input.runId);
      if (error) throw error;
    },
    onSuccess: () => {
      if (priorSolicitationRecordId) {
        qc.invalidateQueries({ queryKey: listKey(priorSolicitationRecordId) });
      }
    },
  });
}
