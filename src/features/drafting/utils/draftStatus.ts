import type { ProposalDraft } from "../hooks/useProposalDrafts";

export type DraftStatus = "none" | "ai" | "edited" | "polished";

export const STATUS_LABEL: Record<DraftStatus, string> = {
  none: "No draft",
  ai: "AI draft",
  edited: "Edited",
  polished: "Polished",
};

export const STATUS_COLOR_VAR: Record<DraftStatus, string> = {
  none: "--status-none",
  ai: "--status-ai",
  edited: "--status-edited",
  polished: "--status-polished",
};

/**
 * Derive a section's status from its draft row + the most recent AI snapshot
 * timestamp (the timestamp of the latest proposal_draft_versions row with
 * change_summary starting with "Pre-").
 *
 * Rule: any human save after the last AI snapshot => "edited".
 */
export function deriveDraftStatus(
  draft: ProposalDraft | undefined | null,
  lastAiSnapshotAt: string | null,
): DraftStatus {
  if (!draft) return "none";
  const action = draft.last_ai_action ?? null;
  const updatedAt = draft.updated_at ? new Date(draft.updated_at).getTime() : 0;
  const aiAt = lastAiSnapshotAt ? new Date(lastAiSnapshotAt).getTime() : 0;

  // If there's a snapshot AND the draft has been updated after it,
  // a human save happened since the last AI run.
  if (aiAt > 0 && updatedAt > aiAt + 1500) return "edited";

  // No snapshot yet but draft exists and no AI action set -> human-created
  if (!action && aiAt === 0) return "edited";

  if (action && action !== "draft") return "polished";
  return "ai";
}
