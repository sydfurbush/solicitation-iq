import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { ClientDecision } from "../utils/clientDecisions";

interface DecisionInput {
  questionId: string;
  decision: ClientDecision;
  note?: string | null;
  questionText?: string | null;
  clientUserId: string;
}

export function useUpdateClientDecision(solicitationId?: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: DecisionInput) => {
      const updates: Record<string, unknown> = {
        client_decision: input.decision,
        client_decision_by: input.clientUserId,
        client_decided_at: new Date().toISOString(),
      };
      if (input.note !== undefined) updates.client_note = input.note;
      if (input.questionText !== undefined && input.questionText !== null) {
        updates.question_text = input.questionText;
      }
      const { error } = await supabase
        .from("strategic_questions")
        .update(updates)
        .eq("id", input.questionId);
      if (error) throw error;
    },
    onSuccess: () => {
      if (solicitationId) {
        qc.invalidateQueries({ queryKey: ["strategic-questions", solicitationId] });
        qc.invalidateQueries({ queryKey: ["portal-questions", solicitationId] });
      }
    },
  });
}

export function useSubmitClientReview(solicitationId?: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { clientUserId: string; clientUserName: string }) => {
      if (!solicitationId) throw new Error("Missing solicitationId");

      // Fetch assigned analysts so we can notify them.
      const { data: assignees, error: aErr } = await supabase
        .from("solicitation_assignments")
        .select("user_id")
        .eq("solicitation_id", solicitationId);
      if (aErr) throw aErr;

      // Get the client_user records for the assigned analysts (notifications go to client_users
      // table only — analysts get notified via activity_log + a future staff notification surface).
      // For now we log an activity entry; the analyst sees it in the activity feed.
      const { error: actErr } = await supabase.rpc("log_activity", {
        p_solicitation_id: solicitationId,
        p_user_id: input.clientUserId,
        p_event_type: "client_review_complete",
        p_event_description: `${input.clientUserName} submitted question review decisions`,
        p_entity_type: "solicitation",
        p_entity_id: solicitationId,
        p_metadata: { assigned_user_ids: (assignees ?? []).map((a) => a.user_id) },
      });
      if (actErr) console.warn("log_activity failed", actErr);
    },
    onSuccess: () => {
      if (solicitationId) {
        qc.invalidateQueries({ queryKey: ["strategic-questions", solicitationId] });
        qc.invalidateQueries({ queryKey: ["portal-questions", solicitationId] });
      }
    },
  });
}
