import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type {
  AnalysisMetadata,
  AnalysisEvaluationFactor,
  AnalysisRequirement,
} from "../prompts/solicitationAnalysis";

export interface SolicitationInsights {
  ai_summary: string | null;
  confidence_score: number | null;
  key_requirements: AnalysisRequirement[];
  evaluation_factors: AnalysisEvaluationFactor[];
  metadata: AnalysisMetadata | null;
  status: string | null;
  has_incumbent: boolean | null;
  incumbent_name: string | null;
  incumbent_contract_number: string | null;
}

export function useRunAnalysis(solicitationId: string | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (analysisType: "full" | "incremental" = "full") => {
      if (!solicitationId) throw new Error("Missing solicitationId");
      const { data, error } = await supabase.functions.invoke("analyze-solicitation", {
        body: { solicitationId, analysisType },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      return data;
    },
    onSuccess: () => {
      if (!solicitationId) return;
      qc.invalidateQueries({ queryKey: ["solicitation-insights", solicitationId] });
      qc.invalidateQueries({ queryKey: ["solicitation", solicitationId] });
    },
  });
}

export function useSolicitationInsights(solicitationId: string | undefined) {
  return useQuery({
    queryKey: ["solicitation-insights", solicitationId],
    enabled: !!solicitationId,
    queryFn: async (): Promise<SolicitationInsights> => {
      const { data, error } = await supabase
        .from("solicitations")
        .select(
          "ai_summary, ai_confidence_score, key_requirements, evaluation_factors, metadata, status, has_incumbent, incumbent_name, incumbent_contract_number"
        )
        .eq("id", solicitationId!)
        .maybeSingle();
      if (error) throw error;
      const meta = (data?.metadata as Record<string, unknown> | null) ?? null;
      const analysisMeta = (meta?.analysis as AnalysisMetadata | undefined) ?? null;
      return {
        ai_summary: data?.ai_summary ?? null,
        confidence_score: data?.ai_confidence_score != null ? Number(data.ai_confidence_score) : null,
        key_requirements: (data?.key_requirements as unknown as AnalysisRequirement[] | null) ?? [],
        evaluation_factors: (data?.evaluation_factors as unknown as AnalysisEvaluationFactor[] | null) ?? [],
        metadata: analysisMeta,
        status: data?.status ?? null,
        has_incumbent: data?.has_incumbent ?? null,
        incumbent_name: data?.incumbent_name ?? null,
        incumbent_contract_number: data?.incumbent_contract_number ?? null,
      };
    },
  });
}

export function useAnalysisStatus(solicitationId: string | undefined, isRunning: boolean) {
  return useQuery({
    queryKey: ["analysis-status", solicitationId],
    enabled: !!solicitationId,
    refetchInterval: isRunning ? 3000 : false,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("solicitations")
        .select("status, metadata")
        .eq("id", solicitationId!)
        .maybeSingle();
      if (error) throw error;
      const meta = (data?.metadata as Record<string, unknown> | null) ?? null;
      const analysis = meta?.analysis as AnalysisMetadata | undefined;
      return {
        status: data?.status ?? null,
        lastAnalyzedAt: analysis?.last_analyzed_at ?? null,
      };
    },
  });
}

export function useUpdateRequirementCompliance(solicitationId: string | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      requirements,
    }: {
      requirements: AnalysisRequirement[];
    }) => {
      if (!solicitationId) throw new Error("Missing solicitationId");
      const { error } = await supabase
        .from("solicitations")
        .update({ key_requirements: requirements as unknown as never })
        .eq("id", solicitationId);
      if (error) throw error;
    },
    onSuccess: () => {
      if (!solicitationId) return;
      qc.invalidateQueries({ queryKey: ["solicitation-insights", solicitationId] });
    },
  });
}

export function useUpdateExecutiveSummary(solicitationId: string | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (summary: string) => {
      if (!solicitationId) throw new Error("Missing solicitationId");
      const { error } = await supabase
        .from("solicitations")
        .update({ ai_summary: summary })
        .eq("id", solicitationId);
      if (error) throw error;
    },
    onSuccess: () => {
      if (!solicitationId) return;
      qc.invalidateQueries({ queryKey: ["solicitation-insights", solicitationId] });
    },
  });
}
