import { Check } from "lucide-react";
import { cn } from "@/lib/utils";
import { PHASES, type PhaseType } from "@/lib/validators/solicitation";

const PHASE_LABELS: Record<PhaseType, string> = {
  phase_1_initial: "Initial",
  phase_2_deep_dive: "Deep Dive",
  phase_3_outline: "Proposal Development",
};

const PHASE_BG: Record<PhaseType, string> = {
  phase_1_initial: "bg-[hsl(var(--phase-1))] border-[hsl(var(--phase-1))]",
  phase_2_deep_dive: "bg-[hsl(var(--phase-2))] border-[hsl(var(--phase-2))]",
  phase_3_outline: "bg-[hsl(var(--phase-3))] border-[hsl(var(--phase-3))]",
};

const PHASE_RING: Record<PhaseType, string> = {
  phase_1_initial: "ring-[hsl(var(--phase-1)/0.35)]",
  phase_2_deep_dive: "ring-[hsl(var(--phase-2)/0.35)]",
  phase_3_outline: "ring-[hsl(var(--phase-3)/0.35)]",
};

const PHASE_TEXT: Record<PhaseType, string> = {
  phase_1_initial: "text-[hsl(var(--phase-1))]",
  phase_2_deep_dive: "text-[hsl(var(--phase-2))]",
  phase_3_outline: "text-[hsl(var(--phase-3))]",
};

const PHASE_CONNECTOR: Record<PhaseType, string> = {
  phase_1_initial: "bg-[hsl(var(--phase-1))]",
  phase_2_deep_dive: "bg-[hsl(var(--phase-2))]",
  phase_3_outline: "bg-[hsl(var(--phase-3))]",
};

interface Props {
  current?: string | null;
  status?: string | null;
  compact?: boolean;
  onPhaseClick?: (phase: PhaseType) => void;
}

export function PhaseIndicator({ current, status, compact, onPhaseClick }: Props) {
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
                !onPhaseClick && "cursor-default",
              )}
              disabled={!onPhaseClick}
            >
              <span
                className={cn(
                  "inline-flex items-center justify-center rounded-full text-[12px] font-semibold border-2 transition-all",
                  compact ? "h-6 w-6" : "h-8 w-8",
                  isDone && cn(PHASE_BG[p], "text-white"),
                  isCurrent && cn(PHASE_BG[p], "text-white ring-4 animate-pulse", PHASE_RING[p]),
                  isFuture && "bg-background text-muted-foreground border-border",
                )}
              >
                {isDone ? <Check className={compact ? "h-3.5 w-3.5" : "h-4 w-4"} /> : idx + 1}
              </span>
              {!compact && (
                <span
                  className={cn(
                    "text-xs font-medium",
                    isCurrent && PHASE_TEXT[p],
                    isDone && "text-foreground",
                    isFuture && "text-muted-foreground",
                  )}
                >
                  {PHASE_LABELS[p]}
                </span>
              )}
            </button>
            {idx < PHASES.length - 1 && !compact && (
              <span
                className={cn(
                  "mx-2 flex-1 rounded-full transition-colors h-1",
                  idx < currentIdx || isComplete ? PHASE_CONNECTOR[p] : "bg-border",
                )}
              />
            )}
          </li>
        );
      })}
    </ol>
  );
}
