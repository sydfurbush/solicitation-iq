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
function invalidateQuestionCounts(qc: ReturnType<typeof useQueryClient>, solicitationId: string) {
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

      const { data, error } = await supabase.functions.invoke("generate-questions", {
        body: {
          solicitationId,
          focusAreas: input.focusAreas,
          focusDocumentIds: input.focusDocumentIds,
          retryRunId: input.retryRunId,
        },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      const runId: string | undefined = data?.runId;
      if (!runId) throw new Error("Generation did not return a run id");

      const deadline = Date.now() + 10 * 60 * 1000;
      while (Date.now() < deadline) {
        await new Promise((r) => setTimeout(r, 1500));
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
          if (run.status === "completed" || run.status === "partial" || run.status === "failed") {
            return {
              status: run.status as "completed" | "partial" | "failed",
              count: run.inserted_count ?? 0,
              failedBatches: run.failed_batches ?? 0,
              error: run.error_message,
            };
          }
        }
      }
      throw new Error("Generation timed out. Check back shortly — questions may still appear.");
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
