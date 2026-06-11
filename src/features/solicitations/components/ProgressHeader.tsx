import { useEffect, useMemo } from "react";
import { Check, Clock } from "lucide-react";
import { format as formatDate } from "date-fns";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { PHASES, type PhaseType } from "@/lib/validators/solicitation";
import { PhaseIndicator } from "./PhaseIndicator";
import { AdvancePhaseButton } from "@/features/phases/components/AdvancePhaseButton";
import { PhaseApprovalStrip } from "@/features/phases/components/PhaseApprovalStrip";
import { usePhaseApprovals } from "@/features/phases/hooks/usePhaseApprovals";
import { daysUntil, dueUrgency } from "../lib/format";

export interface SubStep {
  key: string;
  label: string;
}

interface Props {
  solicitationId: string;
  currentPhase: PhaseType;
  status?: string | null;
  proposalDueDate?: string | null;
  /** All sub-steps for the active phase (only Phase 3 today). */
  phase3Steps: SubStep[];
  /** URL-active phase tab key ("phase-1" | "phase-2" | "phase-3" | ...). */
  activeTab: string;
  /** URL-active sub-step key, or null. */
  activeStep: string | null;
  onPhaseClick: (p: PhaseType) => void;
  onSubStepClick: (key: string) => void;
}

function readFurthest(solicitationId: string): number {
  if (typeof window === "undefined") return -1;
  const raw = window.localStorage.getItem(`phase3_furthest_${solicitationId}`);
  const n = raw ? Number.parseInt(raw, 10) : -1;
  return Number.isFinite(n) ? n : -1;
}

function writeFurthest(solicitationId: string, idx: number) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(`phase3_furthest_${solicitationId}`, String(idx));
}

export function ProgressHeader({
  solicitationId,
  currentPhase,
  status,
  proposalDueDate,
  phase3Steps,
  activeTab,
  activeStep,
  onPhaseClick,
  onSubStepClick,
}: Props) {
  const urgency = useMemo(() => dueUrgency(proposalDueDate), [proposalDueDate]);
  const days = useMemo(() => daysUntil(proposalDueDate), [proposalDueDate]);
  const isPhase3 = currentPhase === "phase_3_outline" || activeTab === "phase-3";
  const allComplete = status === "complete";

  // Persist furthest visited sub-step so circles before the active one read as "done".
  const activeIdx = useMemo(() => {
    if (!activeStep || activeTab !== "phase-3") return -1;
    return phase3Steps.findIndex((s) => s.key === activeStep);
  }, [activeStep, activeTab, phase3Steps]);

  useEffect(() => {
    if (activeIdx < 0) return;
    const prev = readFurthest(solicitationId);
    if (activeIdx > prev) writeFurthest(solicitationId, activeIdx);
  }, [activeIdx, solicitationId]);

  const furthest = readFurthest(solicitationId);
  const phaseIdx = PHASES.indexOf(currentPhase);
  const phase3StartedOrPast = phaseIdx >= PHASES.indexOf("phase_3_outline");

  const stepState = (idx: number): "done" | "active" | "todo" => {
    if (allComplete) return "done";
    if (!phase3StartedOrPast) return "todo";
    if (activeTab === "phase-3" && idx === activeIdx) return "active";
    if (idx <= furthest) return "done";
    // If user is in phase 3 but hasn't visited this step yet
    if (activeTab === "phase-3" && idx < activeIdx) return "done";
    return "todo";
  };

  const { byPhase } = usePhaseApprovals(solicitationId);

  return (
    <Card className="overflow-hidden">
      <CardContent className="p-5 space-y-5">
        {/* Top row: phase strip + due date */}
        <div className="flex flex-col lg:flex-row gap-6 lg:items-center">
          <div className="flex-1 min-w-0">
            <p className="text-[10px] text-muted-foreground mb-2 uppercase tracking-[0.12em] font-medium">
              Progress
            </p>
            <PhaseIndicator
              current={currentPhase}
              status={status}
              onPhaseClick={onPhaseClick}
            />
          </div>
          <div className="lg:border-l lg:pl-6 flex items-start gap-6">
            <div>
              <p className="text-[10px] text-muted-foreground mb-1 uppercase tracking-[0.12em] font-medium">
                Proposal due
              </p>
              {proposalDueDate ? (
                <div
                  className={cn(
                    "flex items-center gap-2",
                    urgency === "danger" || urgency === "overdue"
                      ? "text-destructive"
                      : urgency === "warning"
                        ? "text-amber-600 dark:text-amber-500"
                        : "",
                  )}
                >
                  <Clock className="h-4 w-4" />
                  <div>
                    <p className="text-sm font-semibold">
                      {formatDate(new Date(proposalDueDate), "PPP")}
                    </p>
                    {days !== null && (
                      <p className="text-xs">
                        {days < 0 ? `${Math.abs(days)} days overdue` : `${days} days left`}
                      </p>
                    )}
                  </div>
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">No due date set</p>
              )}
            </div>
          </div>
        </div>

        {/* Phase 3 sub-step rail */}
        {isPhase3 && (
          <div className="rounded-md border bg-muted/30 px-4 py-3.5">
            <div className="flex items-center justify-between mb-3">
              <p className="text-[10px] text-muted-foreground uppercase tracking-[0.12em] font-medium">
                Phase 3 sub-steps
              </p>
              <p className="text-[11px] text-muted-foreground">
                {phase3Steps.filter((_, i) => stepState(i) === "done").length} of {phase3Steps.length} complete
              </p>
            </div>
            <ol className="flex items-center gap-0">
              {phase3Steps.map((s, idx) => {
                const state = stepState(idx);
                const isLast = idx === phase3Steps.length - 1;
                const nextDone = !isLast && stepState(idx + 1) === "done";
                return (
                  <li key={s.key} className="flex items-center flex-1 min-w-0">
                    <button
                      type="button"
                      onClick={() => onSubStepClick(s.key)}
                      className="group flex flex-col items-center gap-1.5 min-w-0 flex-shrink-0"
                    >
                      <span
                        className={cn(
                          "inline-flex items-center justify-center rounded-full text-[11px] font-semibold border-2 h-7 w-7 transition-all",
                          state === "done" && "bg-[hsl(var(--phase-3))] border-[hsl(var(--phase-3))] text-white",
                          state === "active" &&
                            "bg-[hsl(var(--phase-3))] border-[hsl(var(--phase-3))] text-white ring-4 ring-[hsl(var(--phase-3)/0.3)] animate-pulse",
                          state === "todo" &&
                            "bg-background border-border text-muted-foreground group-hover:border-[hsl(var(--phase-3)/0.6)]",
                        )}
                      >
                        {state === "done" ? <Check className="h-3.5 w-3.5" /> : idx + 1}
                      </span>
                      <span
                        className={cn(
                          "text-[11px] font-medium whitespace-nowrap transition-colors",
                          state === "active" && "text-[hsl(var(--phase-3))]",
                          state === "done" && "text-foreground",
                          state === "todo" && "text-muted-foreground group-hover:text-foreground",
                        )}
                      >
                        {s.label}
                      </span>
                    </button>
                    {!isLast && (
                      <span
                        className={cn(
                          "mx-2 h-0.5 flex-1 rounded-full -mt-5 transition-colors",
                          state === "done" && (nextDone || stepState(idx + 1) === "active")
                            ? "bg-[hsl(var(--phase-3))]"
                            : "bg-border",
                        )}
                      />
                    )}
                  </li>
                );
              })}
            </ol>
          </div>
        )}

        {/* Approvals + advance */}
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between border-t pt-4">
          <PhaseApprovalStrip byPhase={byPhase} variant="compact" />
          <AdvancePhaseButton solicitationId={solicitationId} currentPhase={currentPhase} />
        </div>
      </CardContent>
    </Card>
  );
}
