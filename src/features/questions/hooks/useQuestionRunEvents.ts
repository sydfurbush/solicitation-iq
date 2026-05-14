import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type QuestionRunEvent = {
  id: string;
  run_id: string;
  solicitation_id: string;
  event_type: string;
  message: string | null;
  metadata: Record<string, unknown> | null;
  created_at: string;
};

export function useQuestionRunEvents(runId: string | undefined, enabled = true) {
  return useQuery({
    queryKey: ["question-run-events", runId],
    enabled: !!runId && enabled,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("question_generation_run_events")
        .select("*")
        .eq("run_id", runId!)
        .order("created_at", { ascending: true })
        .limit(500);
      if (error) throw error;
      return (data ?? []) as unknown as QuestionRunEvent[];
    },
    refetchInterval: (query) => {
      const rows = query.state.data as QuestionRunEvent[] | undefined;
      // Keep polling while no terminal event has been recorded.
      const terminal = new Set(["completed", "partial", "failed", "reaped"]);
      const last = rows?.[rows.length - 1];
      return last && terminal.has(last.event_type) ? false : 4000;
    },
  });
}

/**
 * Calls the `reap_stale_question_runs` Postgres function to mark any runs that
 * have been "running" with no progress for more than `_threshold_minutes` as
 * failed. Returns the number of runs reaped.
 */
export function useReapStaleRuns(solicitationId: string | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (thresholdMinutes = 8) => {
      if (!solicitationId) return 0;
      const { data, error } = await supabase.rpc("reap_stale_question_runs", {
        _solicitation_id: solicitationId,
        _threshold_minutes: thresholdMinutes,
      });
      if (error) throw error;
      return (data as number) ?? 0;
    },
    onSuccess: (reaped) => {
      if (reaped > 0 && solicitationId) {
        qc.invalidateQueries({ queryKey: ["question-generation-runs", solicitationId] });
        qc.invalidateQueries({ queryKey: ["latest-question-run", solicitationId] });
      }
    },
  });
}
