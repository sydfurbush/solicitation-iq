import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";

export type OpportunityRow = Database["public"]["Tables"]["opportunities"]["Row"];
export type OpportunityType = Database["public"]["Enums"]["opportunity_type"];

const key = (id: string) => ["opportunities", id] as const;

export function useOpportunities(solicitationId: string | undefined) {
  return useQuery({
    queryKey: solicitationId ? key(solicitationId) : ["opportunities", "none"],
    enabled: !!solicitationId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("opportunities")
        .select("*")
        .eq("solicitation_id", solicitationId!)
        .order("impact_score", { ascending: false });
      if (error) throw error;
      return (data ?? []) as OpportunityRow[];
    },
  });
}

export function useCreateOpportunity(solicitationId: string | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (
      input: Partial<OpportunityRow> &
        Pick<OpportunityRow, "title" | "description" | "opportunity_type">
    ) => {
      if (!solicitationId) throw new Error("Missing solicitationId");
      const { error } = await supabase.from("opportunities").insert({
        solicitation_id: solicitationId,
        title: input.title,
        description: input.description,
        opportunity_type: input.opportunity_type,
        impact_score: input.impact_score ?? 50,
        source_document_id: input.source_document_id ?? null,
        source_citation: input.source_citation ?? null,
        source_quote: input.source_quote ?? null,
        recommended_approach: input.recommended_approach ?? null,
        client_capability_match: input.client_capability_match ?? null,
        is_ai_generated: false,
      });
      if (error) throw error;
    },
    onSuccess: () => solicitationId && qc.invalidateQueries({ queryKey: key(solicitationId) }),
  });
}

export function useUpdateOpportunity(solicitationId: string | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: Partial<OpportunityRow> }) => {
      const { error } = await supabase.from("opportunities").update(updates).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => solicitationId && qc.invalidateQueries({ queryKey: key(solicitationId) }),
  });
}

export function useDeleteOpportunity(solicitationId: string | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("opportunities").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => solicitationId && qc.invalidateQueries({ queryKey: key(solicitationId) }),
  });
}
