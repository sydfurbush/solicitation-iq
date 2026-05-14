import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  filterQuestions,
  sortQuestions,
  type QuestionFilters,
  type QuestionRow,
} from "../utils/questionHelpers";

const qsKey = (id: string) => ["strategic-questions", id] as const;

// Invalidate every query that exposes a question count for this solicitation.
// The detail StatCard and Solicitations list both read embedded counts from
// `["solicitation", id]` / `["solicitations", ...]`, so they must be refreshed
// whenever questions are added, edited, or removed.
export function invalidateQuestionCounts(qc: ReturnType<typeof useQueryClient>, solicitationId: string) {
  qc.invalidateQueries({ queryKey: qsKey(solicitationId) });
  qc.invalidateQueries({ queryKey: ["solicitation", solicitationId] });
  qc.invalidateQueries({ queryKey: ["solicitations"] });
}

export function useStrategicQuestions(
  solicitationId: string | undefined,
  filters?: QuestionFilters,
  sortBy: "priority" | "recent" | "category" = "priority"
) {
  return useQuery({
    queryKey: solicitationId ? qsKey(solicitationId) : ["strategic-questions", "none"],
    enabled: !!solicitationId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("strategic_questions")
        .select("*")
        .eq("solicitation_id", solicitationId!)
        .order("priority", { ascending: false });
      if (error) throw error;
      return (data ?? []) as QuestionRow[];
    },
    select: (data) => sortQuestions(filters ? filterQuestions(data, filters) : data, sortBy),
  });
}

export function useLatestQuestionRun(solicitationId: string | undefined) {
  return useQuery({
    queryKey: ["latest-question-run", solicitationId],
    enabled: !!solicitationId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("question_generation_runs")
        .select("id, status, failed_batches, failed_doc_ids, cross_doc_failed, completed_at, inserted_count, total_batches")
        .eq("solicitation_id", solicitationId!)
        .order("started_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });
}

export function useGenerateQuestions(solicitationId: string | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      focusAreas?: string[];
      focusDocumentIds?: string[];
      retryRunId?: string;
      onProgress?: (p: {
        runId: string;
        status: string;
        completed: number;
        total: number;
        failed: number;
        inserted: number;
        step: string | null;
      }) => void;
    }) => {
      if (!solicitationId) throw new Error("Missing solicitationId");

      // First call: either start a new run or kick off a retry. The edge function
      // processes a small slice of chunks and returns; we loop "continue" calls
      // until the run is done. This avoids one giant background task that can be
      // killed mid-run.
      const initial = await supabase.functions.invoke("generate-questions", {
        body: {
          solicitationId,
          focusAreas: input.focusAreas,
          focusDocumentIds: input.focusDocumentIds,
          retryRunId: input.retryRunId,
        },
      });
      if (initial.error) throw initial.error;
      if (initial.data?.error) throw new Error(initial.data.error);
      const runId: string | undefined = initial.data?.runId;
      if (!runId) throw new Error("Generation did not return a run id");

      const reportProgress = async () => {
        const { data: run } = await supabase
          .from("question_generation_runs")
          .select("status, total_batches, completed_batches, failed_batches, inserted_count, current_step, error_message")
          .eq("id", runId)
          .maybeSingle();
        if (run) {
          input.onProgress?.({
            runId,
            status: run.status as string,
            completed: run.completed_batches ?? 0,
            total: run.total_batches ?? 0,
            failed: run.failed_batches ?? 0,
            inserted: run.inserted_count ?? 0,
            step: run.current_step ?? null,
          });
          invalidateQuestionCounts(qc, solicitationId);
        }
        return run;
      };

      let last = initial.data as { done?: boolean; remaining?: number } | undefined;
      await reportProgress();

      const deadline = Date.now() + 20 * 60 * 1000; // hard ceiling
      while (last && !last.done && Date.now() < deadline) {
        // brief gap so the UI gets a chance to render and to avoid hammering
        await new Promise((r) => setTimeout(r, 500));
        const next = await supabase.functions.invoke("generate-questions", {
          body: { runId, continue: true },
        });
        if (next.error) throw next.error;
        if (next.data?.error) throw new Error(next.data.error);
        last = next.data;
        await reportProgress();
      }

      const finalRun = await reportProgress();
      const status = (finalRun?.status as "completed" | "partial" | "failed") ?? "failed";
      return {
        status,
        count: finalRun?.inserted_count ?? 0,
        failedBatches: finalRun?.failed_batches ?? 0,
        error: finalRun?.error_message ?? null,
      };
    },
    onSuccess: () => {
      if (solicitationId) {
        invalidateQuestionCounts(qc, solicitationId);
        qc.invalidateQueries({ queryKey: ["latest-question-run", solicitationId] });
      }
    },
  });
}

export function useCreateQuestion(solicitationId: string | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (
      input: Partial<QuestionRow> & Pick<QuestionRow, "question_text" | "category">
    ) => {
      if (!solicitationId) throw new Error("Missing solicitationId");
      const { error } = await supabase.from("strategic_questions").insert({
        solicitation_id: solicitationId,
        question_text: input.question_text,
        category: input.category,
        recommendation: input.recommendation ?? "monitor",
        priority: input.priority ?? 50,
        question_rationale: input.question_rationale ?? null,
        source_document_id: input.source_document_id ?? null,
        source_section_id: input.source_section_id ?? null,
        source_citation: input.source_citation ?? null,
        source_quote: input.source_quote ?? null,
        strategic_advantage_notes: input.strategic_advantage_notes ?? null,
        is_ai_generated: false,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      if (solicitationId) invalidateQuestionCounts(qc, solicitationId);
    },
  });
}

export function useUpdateQuestion(solicitationId: string | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: Partial<QuestionRow> }) => {
      const { error } = await supabase.from("strategic_questions").update(updates).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      if (solicitationId) invalidateQuestionCounts(qc, solicitationId);
    },
  });
}

export function useDeleteQuestion(solicitationId: string | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("strategic_questions").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      if (solicitationId) invalidateQuestionCounts(qc, solicitationId);
    },
  });
}

export function useBulkUpdateQuestions(solicitationId: string | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ ids, updates }: { ids: string[]; updates: Partial<QuestionRow> }) => {
      const { error } = await supabase.from("strategic_questions").update(updates).in("id", ids);
      if (error) throw error;
    },
    onSuccess: () => {
      if (solicitationId) invalidateQuestionCounts(qc, solicitationId);
    },
  });
}
