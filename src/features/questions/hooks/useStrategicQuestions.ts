import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  filterQuestions,
  sortQuestions,
  type QuestionFilters,
  type QuestionRow,
} from "../utils/questionHelpers";

const qsKey = (id: string) => ["strategic-questions", id] as const;

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

export function useGenerateQuestions(solicitationId: string | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      focusAreas?: string[];
      focusDocumentIds?: string[];
      regenerate?: boolean;
    }) => {
      if (!solicitationId) throw new Error("Missing solicitationId");
      const { data, error } = await supabase.functions.invoke("generate-questions", {
        body: { solicitationId, ...input },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      return data;
    },
    onSuccess: () => {
      if (solicitationId) qc.invalidateQueries({ queryKey: qsKey(solicitationId) });
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
      if (solicitationId) qc.invalidateQueries({ queryKey: qsKey(solicitationId) });
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
      if (solicitationId) qc.invalidateQueries({ queryKey: qsKey(solicitationId) });
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
      if (solicitationId) qc.invalidateQueries({ queryKey: qsKey(solicitationId) });
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
      if (solicitationId) qc.invalidateQueries({ queryKey: qsKey(solicitationId) });
    },
  });
}
