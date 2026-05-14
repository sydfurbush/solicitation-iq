import type { Database } from "@/integrations/supabase/types";

export type ClientDecision = Database["public"]["Enums"]["client_question_decision"];
export type ClarificationItemStatus = Database["public"]["Enums"]["clarification_item_status"];
export type ClarificationPackageStatus = Database["public"]["Enums"]["clarification_package_status"];

export const CLIENT_DECISIONS: ClientDecision[] = ["clarify", "hold", "remove", "deferred"];

export const DECISION_LABEL: Record<ClientDecision, string> = {
  pending: "Not decided",
  clarify: "Send for clarification",
  hold: "Hold (competitive edge)",
  remove: "Remove",
  deferred: "Defer / discuss",
};

export const DECISION_SHORT: Record<ClientDecision, string> = {
  pending: "Pending",
  clarify: "Clarify",
  hold: "Hold",
  remove: "Remove",
  deferred: "Defer",
};

export const DECISION_DESCRIPTION: Record<ClientDecision, string> = {
  pending: "No decision recorded yet.",
  clarify: "Send to the agency. A note explaining the concern is required.",
  hold: "Keep internal — useful intel, do not tip our hand to the agency.",
  remove: "Drop the question; not worth asking.",
  deferred: "Need a conversation with the analyst before deciding.",
};

export function decisionBadgeClasses(d: ClientDecision): string {
  switch (d) {
    case "clarify":
      return "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-500/30";
    case "hold":
      return "bg-amber-500/15 text-amber-700 dark:text-amber-400 border-amber-500/30";
    case "remove":
      return "bg-destructive/15 text-destructive border-destructive/30";
    case "deferred":
      return "bg-blue-500/15 text-blue-700 dark:text-blue-400 border-blue-500/30";
    case "pending":
    default:
      return "bg-muted text-muted-foreground border-border";
  }
}

export const ITEM_STATUS_LABEL: Record<ClarificationItemStatus, string> = {
  none: "Not drafted",
  drafting: "Draft in progress",
  ready: "Ready",
  submitted: "Submitted",
};

export const PACKAGE_STATUS_LABEL: Record<ClarificationPackageStatus, string> = {
  draft: "Draft",
  ready: "Ready for client",
  submitted: "Submitted to agency",
};
