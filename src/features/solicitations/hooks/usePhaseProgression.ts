import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { PHASES, type PhaseType } from "@/lib/validators/solicitation";

export const PHASE_TAB: Record<PhaseType, string> = {
  phase_1_initial: "phase-1",
  phase_2_deep_dive: "phase-2",
  phase_3_outline: "phase-3",
  phase_4_win_themes: "phase-4",
};

export const TAB_PHASE: Record<string, PhaseType> = {
  "phase-1": "phase_1_initial",
  "phase-2": "phase_2_deep_dive",
  "phase-3": "phase_3_outline",
  "phase-4": "phase_4_win_themes",
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
