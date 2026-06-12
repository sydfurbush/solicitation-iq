import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";

export type Outcome = Database["public"]["Tables"]["solicitation_outcomes"]["Row"];
export type OutcomeStatus = Database["public"]["Enums"]["outcome_status"];

const KEY = (id: string | undefined) => ["solicitation-outcome", id ?? "none"] as const;

export function useSolicitationOutcome(solicitationId: string | undefined) {
  return useQuery({
    queryKey: KEY(solicitationId),
    enabled: !!solicitationId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("solicitation_outcomes")
        .select("*")
        .eq("solicitation_id", solicitationId!)
        .maybeSingle();
      if (error) throw error;
      return (data as Outcome | null) ?? null;
    },
  });
}

export function useUpsertOutcome(solicitationId: string | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      outcome: OutcomeStatus;
      awarded_value?: number | null;
      awarded_at?: string | null;
      notes?: string | null;
    }) => {
      if (!solicitationId) throw new Error("Missing solicitationId");
      const { data: auth } = await supabase.auth.getUser();
      const uid = auth.user?.id ?? null;
      const { data, error } = await supabase
        .from("solicitation_outcomes")
        .upsert(
          {
            solicitation_id: solicitationId,
            outcome: input.outcome,
            awarded_value: input.awarded_value ?? null,
            awarded_at: input.awarded_at ?? null,
            notes: input.notes ?? null,
            recorded_by: uid,
          },
          { onConflict: "solicitation_id" },
        )
        .select()
        .single();
      if (error) throw error;
      return data as Outcome;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: KEY(solicitationId) });
      qc.invalidateQueries({ queryKey: ["reports-hub"] });
    },
  });
}
