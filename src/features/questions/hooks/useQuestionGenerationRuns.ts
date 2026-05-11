import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type QuestionRun = {
  id: string;
  solicitation_id: string;
  status: "running" | "completed" | "partial" | "failed";
  total_batches: number;
  completed_batches: number;
  failed_batches: number;
  inserted_count: number;
  current_step: string | null;
  error_message: string | null;
  failed_doc_ids: string[];
  cross_doc_failed: boolean;
  parent_run_id: string | null;
  started_at: string;
  completed_at: string | null;
  updated_at: string;
};

export function useQuestionGenerationRuns(solicitationId: string | undefined) {
  return useQuery({
    queryKey: ["question-generation-runs", solicitationId],
    enabled: !!solicitationId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("question_generation_runs")
        .select("*")
        .eq("solicitation_id", solicitationId!)
        .order("started_at", { ascending: false })
        .limit(50);
      if (error) throw error;
      return (data ?? []) as unknown as QuestionRun[];
    },
    refetchInterval: (query) => {
      const rows = query.state.data as QuestionRun[] | undefined;
      return rows?.some((r) => r.status === "running") ? 5000 : false;
    },
  });
}
