export type SolicitationStage = "pre_solicitation" | "draft_rfp" | "final" | "amendment";

export const STAGE_LABELS: Record<SolicitationStage, string> = {
  pre_solicitation: "Pre-Solicitation",
  draft_rfp: "Draft RFP",
  final: "Final",
  amendment: "Amendment",
};

export const STAGE_BADGE_CLASSES: Record<SolicitationStage, string> = {
  pre_solicitation: "bg-amber-500/15 text-amber-600 border-amber-500/30",
  draft_rfp: "bg-sky-500/15 text-sky-600 border-sky-500/30",
  final: "bg-emerald-500/15 text-emerald-600 border-emerald-500/30",
  amendment: "bg-blue-500/15 text-blue-600 border-blue-500/30",
};

export const SOLICITATION_STAGES: SolicitationStage[] = [
  "pre_solicitation",
  "draft_rfp",
  "final",
  "amendment",
];
