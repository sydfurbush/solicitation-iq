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

      // Job runs in background; poll up to ~3 min for new rows.
      const startedAt = Date.now();
      const baselineCount = (
        await supabase
          .from("section_analyses")
          .select("id", { count: "exact", head: true })
          .eq("solicitation_id", solicitationId)
          .eq("is_ai_generated", true)
      ).count ?? 0;

      while (Date.now() - startedAt < 180_000) {
        await new Promise((r) => setTimeout(r, 4000));
        const { count } = await supabase
          .from("section_analyses")
          .select("id", { count: "exact", head: true })
          .eq("solicitation_id", solicitationId)
          .eq("is_ai_generated", true)
          .gt("created_at", new Date(startedAt - 1000).toISOString());
        if ((count ?? 0) > 0 && (count ?? 0) !== baselineCount) break;
      }
      return data;
    },
    onSuccess: () => {
      if (!solicitationId) return;
      qc.invalidateQueries({ queryKey: key(solicitationId) });
    },
  });
}
