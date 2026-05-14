import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";

export type FieldProposal = Database["public"]["Tables"]["solicitation_field_proposals"]["Row"];

export const proposalsKey = (solicitationId: string) => ["field-proposals", solicitationId];

export function useFieldProposals(solicitationId: string | undefined) {
  return useQuery({
    queryKey: proposalsKey(solicitationId ?? ""),
    enabled: !!solicitationId,
    queryFn: async (): Promise<FieldProposal[]> => {
      const { data, error } = await supabase
        .from("solicitation_field_proposals")
        .select("*")
        .eq("solicitation_id", solicitationId!)
        .eq("status", "pending")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as FieldProposal[];
    },
  });
}

export function useDecideProposal(solicitationId: string | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      proposal,
      action,
      overrideValue,
    }: {
      proposal: FieldProposal;
      action: "accept" | "reject";
      overrideValue?: unknown;
    }) => {
      if (action === "accept") {
        const value =
          overrideValue !== undefined ? overrideValue : (proposal.proposed_value as unknown);
        const { error: upErr } = await supabase
          .from("solicitations")
          .update({ [proposal.field_name]: value as never })
          .eq("id", proposal.solicitation_id);
        if (upErr) throw upErr;
      }
      const { error } = await supabase
        .from("solicitation_field_proposals")
        .update({
          status: action === "accept" ? "accepted" : "rejected",
          decided_at: new Date().toISOString(),
        })
        .eq("id", proposal.id);
      if (error) throw error;
    },
    onSuccess: () => {
      if (!solicitationId) return;
      qc.invalidateQueries({ queryKey: proposalsKey(solicitationId) });
      qc.invalidateQueries({ queryKey: ["solicitation", solicitationId] });
    },
  });
}

export function useReconcileOverview(solicitationId: string | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      if (!solicitationId) throw new Error("Missing solicitationId");
      const { data, error } = await supabase.functions.invoke("reconcile-solicitation-overview", {
        body: { solicitationId },
      });
      if (error) throw error;
      return data as { ok: boolean; filled: number; proposed: number };
    },
    onSuccess: () => {
      if (!solicitationId) return;
      qc.invalidateQueries({ queryKey: proposalsKey(solicitationId) });
      qc.invalidateQueries({ queryKey: ["solicitation", solicitationId] });
    },
  });
}
