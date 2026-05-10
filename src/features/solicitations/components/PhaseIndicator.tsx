import { Check } from "lucide-react";
import { cn } from "@/lib/utils";
import { PHASES, type PhaseType } from "@/lib/validators/solicitation";

const PHASE_LABELS: Record<PhaseType, string> = {
  phase_1_initial: "Initial",
  phase_2_deep_dive: "Deep Dive",
  phase_3_outline: "Outline",
  phase_4_win_themes: "Win Themes",
};

interface Props {
  current?: string | null;
  status?: string | null;
  compact?: boolean;
  onPhaseClick?: (phase: PhaseType) => void;
}

export function PhaseIndicator({ current, status, compact, onPhaseClick }: Props) {
  // Determine completion: status drives "completed" beyond the current phase
  const currentIdx = PHASES.indexOf((current as PhaseType) ?? "phase_1_initial");
  const isComplete = status === "complete";

  return (
    <ol className={cn("flex items-center", compact ? "gap-1" : "gap-2 w-full")}>
      {PHASES.map((p, idx) => {
        const isCurrent = idx === currentIdx && !isComplete;
        const isDone = isComplete || idx < currentIdx;
        const isFuture = !isCurrent && !isDone;
        return (
          <li key={p} className={cn("flex items-center", !compact && "flex-1")}>
            <button
              type="button"
              onClick={() => onPhaseClick?.(p)}
              className={cn(
                "flex items-center gap-2 rounded-md transition-colors",
                onPhaseClick && "hover:bg-muted px-1.5 py-1",
                !onPhaseClick && "cursor-default"
              )}
              disabled={!onPhaseClick}
            >
              <span
                className={cn(
                  "inline-flex h-6 w-6 items-center justify-center rounded-full text-[11px] font-medium border",
                  isDone && "bg-accent text-accent-foreground border-accent",
                  isCurrent && "bg-primary text-primary-foreground border-primary",
                  isFuture && "bg-background text-muted-foreground border-border"
                )}
              >
                {isDone ? <Check className="h-3.5 w-3.5" /> : idx + 1}
              </span>
              {!compact && (
                <span
                  className={cn(
                    "text-xs font-medium",
                    isCurrent && "text-foreground",
                    !isCurrent && "text-muted-foreground"
                  )}
                >
                  {PHASE_LABELS[p]}
                </span>
              )}
            </button>
            {idx < PHASES.length - 1 && !compact && (
              <span
                className={cn(
                  "mx-2 h-px flex-1",
                  isDone ? "bg-accent" : "bg-border"
                )}
              />
            )}
          </li>
        );
      })}
    </ol>
  );
}
