import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";

export type SectionAnalysis = Database["public"]["Tables"]["section_analyses"]["Row"];

const key = (id: string) => ["section-analyses", id] as const;

export function useSectionAnalyses(solicitationId: string | undefined) {
  return useQuery({
    queryKey: solicitationId ? key(solicitationId) : ["section-analyses", "none"],
    enabled: !!solicitationId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("section_analyses")
        .select("*")
        .eq("solicitation_id", solicitationId!)
        .order("section_code", { ascending: true });
      if (error) throw error;
      return (data ?? []) as SectionAnalysis[];
    },
  });
}

export function useAnalyzeSections(solicitationId: string | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      if (!solicitationId) throw new Error("Missing solicitationId");
      const { data, error } = await supabase.functions.invoke("analyze-sections", {
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
