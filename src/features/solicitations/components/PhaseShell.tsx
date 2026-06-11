import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import type { PhaseType } from "@/lib/validators/solicitation";
import { AdvancePhaseButton } from "@/features/phases/components/AdvancePhaseButton";

const PHASE_LABELS: Record<PhaseType, string> = {
  phase_1_initial: "Initial",
  phase_2_deep_dive: "Deep Dive",
  phase_3_outline: "Proposal Development",
};

export interface PhaseSubStep {
  key: string;
  label: string;
}

interface Props {
  solicitationId: string;
  phase: PhaseType;
  /** Solicitation's actual current phase (used for advance gating) */
  currentPhase: PhaseType;
  subSteps?: PhaseSubStep[];
  activeStep?: string;
  onStepChange?: (key: string) => void;
  children: ReactNode;
}

export function PhaseShell({
  solicitationId,
  phase,
  currentPhase,
  subSteps,
  activeStep,
  onStepChange,
  children,
}: Props) {
  const phaseIdx = ["phase_1_initial", "phase_2_deep_dive", "phase_3_outline", "phase_4_win_themes", "phase_5_drafting"].indexOf(phase);
  const isCurrent = phase === currentPhase;

  return (
    <div className="space-y-5">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <div className="h-8 w-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-sm font-semibold shrink-0">
            {phaseIdx + 1}
          </div>
          <div className="min-w-0">
            <h2 className="text-lg font-semibold leading-tight truncate">
              Phase {phaseIdx + 1} · {PHASE_LABELS[phase]}
            </h2>
            {isCurrent && (
              <Badge variant="outline" className="mt-1 bg-primary/10 text-primary border-primary/30">
                Current phase
              </Badge>
            )}
          </div>
        </div>
        {isCurrent && (
          <AdvancePhaseButton solicitationId={solicitationId} currentPhase={currentPhase} />
        )}
      </div>

      {subSteps && subSteps.length > 0 && (
        <div className="flex flex-wrap gap-1.5 border-b pb-2">
          {subSteps.map((s) => {
            const active = s.key === activeStep;
            return (
              <Button
                key={s.key}
                variant={active ? "default" : "ghost"}
                size="sm"
                onClick={() => onStepChange?.(s.key)}
                className={cn(
                  "h-8",
                  !active && "text-muted-foreground hover:text-foreground",
                )}
              >
                {s.label}
              </Button>
            );
          })}
        </div>
      )}

      <div>{children}</div>
    </div>
  );
}
