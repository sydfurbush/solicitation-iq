import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { PhaseType } from "@/lib/validators/solicitation";

export type ApprovalStatus = "not_ready" | "pending_review" | "approved" | "changes_requested";

export interface PhaseApproval {
  id: string;
  solicitation_id: string;
  phase: PhaseType;
  status: ApprovalStatus;
  requested_at: string | null;
  requested_by: string | null;
  decided_at: string | null;
  decided_by: string | null;
  decided_by_name: string | null;
  decision_note: string | null;
  created_at: string;
  updated_at: string;
}

const KEY = (id: string | undefined) => ["phase-approvals", id];

export function usePhaseApprovals(solicitationId: string | undefined) {
  const qc = useQueryClient();

  const query = useQuery({
    queryKey: KEY(solicitationId),
    enabled: !!solicitationId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("phase_approvals")
        .select("*")
        .eq("solicitation_id", solicitationId!);
      if (error) throw error;
      return (data ?? []) as PhaseApproval[];
    },
  });

  useEffect(() => {
    if (!solicitationId) return;
    const channel = supabase
      .channel(`phase-approvals-${solicitationId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "phase_approvals", filter: `solicitation_id=eq.${solicitationId}` },
        () => qc.invalidateQueries({ queryKey: KEY(solicitationId) }),
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [solicitationId, qc]);

  const byPhase = (query.data ?? []).reduce<Partial<Record<PhaseType, PhaseApproval>>>((acc, row) => {
    acc[row.phase] = row;
    return acc;
  }, {});

  return { approvals: query.data ?? [], byPhase, isLoading: query.isLoading };
}

export function useRequestApproval(solicitationId: string | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: PhaseType | { phase: PhaseType; note?: string }) => {
      if (!solicitationId) throw new Error("Missing solicitation");
      const phase = typeof input === "string" ? input : input.phase;
      const note = typeof input === "string" ? undefined : input.note?.trim() || undefined;
      const { data: u } = await supabase.auth.getUser();
      const { error } = await supabase
        .from("phase_approvals")
        .upsert(
          {
            solicitation_id: solicitationId,
            phase,
            status: "pending_review",
            requested_at: new Date().toISOString(),
            requested_by: u.user?.id ?? null,
            decided_at: null,
            decided_by: null,
            decided_by_name: null,
            decision_note: note ?? null,
          },
          { onConflict: "solicitation_id,phase" },
        );
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY(solicitationId) }),
  });
}

export function useDecideApproval(solicitationId: string | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { approvalId: string; decision: "approved" | "changes_requested"; note?: string; deciderName?: string | null }) => {
      const { validateNote } = await import("../validators");
      const required = input.decision === "changes_requested";
      const note = input.note?.trim() ?? "";
      const err = validateNote(note, required);
      if (err) throw new Error(err);
      const { data: u } = await supabase.auth.getUser();
      const { error } = await supabase
        .from("phase_approvals")
        .update({
          status: input.decision,
          decided_at: new Date().toISOString(),
          decided_by: u.user?.id ?? null,
          decided_by_name: input.deciderName ?? null,
          decision_note: note || null,
        })
        .eq("id", input.approvalId);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY(solicitationId) }),
  });
}

export function useResetApproval(solicitationId: string | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: string | { approvalId: string; note?: string }) => {
      const approvalId = typeof input === "string" ? input : input.approvalId;
      const note = typeof input === "string" ? undefined : input.note?.trim() || undefined;
      const { error } = await supabase
        .from("phase_approvals")
        .update({
          status: "pending_review",
          decided_at: null,
          decided_by: null,
          decided_by_name: null,
          decision_note: note ?? null,
          requested_at: new Date().toISOString(),
        })
        .eq("id", approvalId);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY(solicitationId) }),
  });
}

export const APPROVAL_LABEL: Record<ApprovalStatus, string> = {
  not_ready: "Not ready",
  pending_review: "Pending review",
  approved: "Approved",
  changes_requested: "Changes requested",
};
