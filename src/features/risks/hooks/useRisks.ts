import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";

export type RiskRow = Database["public"]["Tables"]["risks"]["Row"];
export type RiskSeverity = Database["public"]["Enums"]["risk_severity"];

const key = (id: string) => ["risks", id] as const;

export function useRisks(solicitationId: string | undefined) {
  return useQuery({
    queryKey: solicitationId ? key(solicitationId) : ["risks", "none"],
    enabled: !!solicitationId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("risks")
        .select("*")
        .eq("solicitation_id", solicitationId!)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as RiskRow[];
    },
  });
}

export function useCreateRisk(solicitationId: string | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: Partial<RiskRow> & Pick<RiskRow, "title" | "description">) => {
      if (!solicitationId) throw new Error("Missing solicitationId");
      const { error } = await supabase.from("risks").insert({
        solicitation_id: solicitationId,
        title: input.title,
        description: input.description,
        severity: input.severity ?? "medium",
        source_document_id: input.source_document_id ?? null,
        source_citation: input.source_citation ?? null,
        source_quote: input.source_quote ?? null,
        mitigation_strategy: input.mitigation_strategy ?? null,
        is_ai_generated: false,
      });
      if (error) throw error;
    },
    onSuccess: () => solicitationId && qc.invalidateQueries({ queryKey: key(solicitationId) }),
  });
}

export function useUpdateRisk(solicitationId: string | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: Partial<RiskRow> }) => {
      const { error } = await supabase.from("risks").update(updates).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => solicitationId && qc.invalidateQueries({ queryKey: key(solicitationId) }),
  });
}

export function useDeleteRisk(solicitationId: string | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("risks").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => solicitationId && qc.invalidateQueries({ queryKey: key(solicitationId) }),
  });
}

export function useMarkRiskMitigated(solicitationId: string | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, isMitigated }: { id: string; isMitigated: boolean }) => {
      const { error } = await supabase
        .from("risks")
        .update({ is_mitigated: isMitigated })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => solicitationId && qc.invalidateQueries({ queryKey: key(solicitationId) }),
  });
}

export function useIdentifyRisksOpportunities(solicitationId: string | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input?: { regenerate?: boolean }) => {
      if (!solicitationId) throw new Error("Missing solicitationId");
      const { data, error } = await supabase.functions.invoke("identify-risks-opportunities", {
        body: { solicitationId, regenerate: input?.regenerate },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      return data;
    },
    onSuccess: () => {
      if (solicitationId) {
        qc.invalidateQueries({ queryKey: key(solicitationId) });
        qc.invalidateQueries({ queryKey: ["opportunities", solicitationId] });
      }
    },
  });
}
