import { useMutation } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface SuggestedSource {
  tag: string;
  document_title: string;
  snippet?: string;
}

export interface SuggestMitigationResult {
  ok: boolean;
  mitigation_strategy: string;
  used_sources: SuggestedSource[];
  knowledge_count: number;
}

export function useSuggestRiskMitigation() {
  return useMutation({
    mutationFn: async (riskId: string): Promise<SuggestMitigationResult> => {
      const { data, error } = await supabase.functions.invoke("suggest-risk-mitigation", {
        body: { riskId },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      return data as SuggestMitigationResult;
    },
  });
}
