import { Check, Clock, AlertCircle, CircleDashed } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { PHASES, type PhaseType } from "@/lib/validators/solicitation";
import { APPROVAL_LABEL, type ApprovalStatus, type PhaseApproval } from "../hooks/usePhaseApprovals";

const PHASE_LABELS: Record<PhaseType, string> = {
  phase_1_initial: "Initial",
  phase_2_deep_dive: "Deep Dive",
  phase_3_outline: "Proposal Development",
};

// Phase 3 is the final phase, so it has no gate.
const GATED_PHASES: PhaseType[] = ["phase_1_initial", "phase_2_deep_dive"];

function statusStyle(status: ApprovalStatus | undefined) {
  switch (status) {
    case "approved":
      return { className: "bg-accent/15 text-accent border-accent/30", icon: Check };
    case "pending_review":
      return { className: "bg-amber-500/15 text-amber-700 dark:text-amber-400 border-amber-500/30 animate-pulse", icon: Clock };
    case "changes_requested":
      return { className: "bg-destructive/15 text-destructive border-destructive/30", icon: AlertCircle };
    default:
      return { className: "text-muted-foreground", icon: CircleDashed };
  }
}

interface Props {
  byPhase: Partial<Record<PhaseType, PhaseApproval>>;
  className?: string;
  variant?: "default" | "compact";
}

export function PhaseApprovalStrip({ byPhase, className, variant = "default" }: Props) {
  return (
    <div className={cn("flex flex-wrap gap-2", className)}>
      {PHASES.map((phase) => {
        const isGated = GATED_PHASES.includes(phase);
        const approval = byPhase[phase];
        const status = (approval?.status ?? "not_ready") as ApprovalStatus;
        const { className: cls, icon: Icon } = statusStyle(status);
        const label = isGated ? APPROVAL_LABEL[status] : "No approval";
        return (
          <Badge
            key={phase}
            variant="outline"
            className={cn("gap-1.5", isGated ? cls : "text-muted-foreground", variant === "compact" && "text-xs")}
            title={isGated ? `${PHASE_LABELS[phase]}: ${label}` : `${PHASE_LABELS[phase]}: gate not required`}
          >
            <Icon className="h-3 w-3" />
            <span className="font-medium">{PHASE_LABELS[phase]}</span>
            <span className="opacity-70">·</span>
            <span>{label}</span>
          </Badge>
        );
      })}
    </div>
  );
}

export { GATED_PHASES };
