import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { PHASES, type PhaseType } from "@/lib/validators/solicitation";

export const PHASE_TAB: Record<PhaseType, string> = {
  phase_1_initial: "overview",
  phase_2_deep_dive: "deep-dive",
  phase_3_outline: "outline",
  phase_4_win_themes: "win-themes",
};

export const TAB_PHASE: Record<string, PhaseType> = {
  "overview": "phase_1_initial",
  "documents": "phase_1_initial",
  "analysis": "phase_1_initial",
  "questions": "phase_1_initial",
  "risks": "phase_1_initial",
  "deep-dive": "phase_2_deep_dive",
  "outline": "phase_3_outline",
  "win-themes": "phase_4_win_themes",
};

export function nextPhase(current: PhaseType | null | undefined): PhaseType | null {
  const idx = PHASES.indexOf((current ?? "phase_1_initial") as PhaseType);
  if (idx < 0 || idx >= PHASES.length - 1) return null;
  return PHASES[idx + 1];
}

export function useAdvancePhase(solicitationId: string | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { from: PhaseType; to: PhaseType }) => {
      if (!solicitationId) throw new Error("Missing solicitationId");
      const { data: userData } = await supabase.auth.getUser();
      const userId = userData.user?.id ?? null;

      // Mark current phase complete
      const { error: phaseErr } = await supabase
        .from("solicitation_phases")
        .upsert(
          {
            solicitation_id: solicitationId,
            phase: input.from,
            status: "complete",
            completed_at: new Date().toISOString(),
            completed_by: userId,
          },
          { onConflict: "solicitation_id,phase" }
        );
      if (phaseErr) console.warn("phase upsert", phaseErr);

      // Start next phase
      await supabase
        .from("solicitation_phases")
        .upsert(
          {
            solicitation_id: solicitationId,
            phase: input.to,
            status: "in_progress",
            started_at: new Date().toISOString(),
          },
          { onConflict: "solicitation_id,phase" }
        );

      // Update solicitation current_phase
      const { error } = await supabase
        .from("solicitations")
        .update({ current_phase: input.to })
        .eq("id", solicitationId);
      if (error) throw error;
    },
    onSuccess: () => {
      if (!solicitationId) return;
      qc.invalidateQueries({ queryKey: ["solicitation", solicitationId] });
      qc.invalidateQueries({ queryKey: ["solicitations"] });
    },
  });
}
