import { ArrowRight, Check, Circle, CircleDashed } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { PHASES, type PhaseType } from "@/lib/validators/solicitation";

type StepState = "done" | "active" | "todo";

export interface HubStep {
  key: string;
  label: string;
  count?: number;
  state?: StepState;
  onClick?: () => void;
}

export interface HubPhase {
  phase: PhaseType;
  index: number;
  title: string;
  description: string;
  state: StepState;
  steps: HubStep[];
  onOpen: () => void;
}

const PHASE_LABELS: Record<PhaseType, string> = {
  phase_1_initial: "Initial",
  phase_2_deep_dive: "Deep Dive",
  phase_3_outline: "Outline",
  phase_4_win_themes: "Win Themes",
};

const PHASE_BLURBS: Record<PhaseType, string> = {
  phase_1_initial: "Set up the file: docs, analysis, questions, risks.",
  phase_2_deep_dive: "Build the RTM, section analysis, and capability gaps.",
  phase_3_outline: "Draft the proposal outline by volume and section.",
  phase_4_win_themes: "Articulate discriminators and win themes.",
};

interface Props {
  currentPhase: PhaseType;
  phaseStatusByPhase: Partial<Record<PhaseType, "not_started" | "in_progress" | "complete">>;
  buildSteps: (phase: PhaseType) => HubStep[];
  onOpenPhase: (phase: PhaseType) => void;
  onWorkspace: (key: "reports" | "comparison" | "activity") => void;
}

function StateDot({ state }: { state: StepState }) {
  if (state === "done") {
    return (
      <span className="inline-flex h-4 w-4 items-center justify-center rounded-full bg-accent text-accent-foreground">
        <Check className="h-3 w-3" />
      </span>
    );
  }
  if (state === "active") {
    return <span className="inline-flex h-3 w-3 rounded-full bg-primary animate-pulse" aria-label="In progress" />;
  }
  return <CircleDashed className="h-3.5 w-3.5 text-muted-foreground" aria-label="Not started" />;
}

export function PhaseHub({
  currentPhase,
  phaseStatusByPhase,
  buildSteps,
  onOpenPhase,
  onWorkspace,
}: Props) {
  const phases: HubPhase[] = PHASES.map((p, i) => {
    const explicit = phaseStatusByPhase[p];
    const idx = PHASES.indexOf(currentPhase);
    let state: StepState = "todo";
    if (explicit === "complete") state = "done";
    else if (explicit === "in_progress" || p === currentPhase) state = "active";
    else if (i < idx) state = "done";
    return {
      phase: p,
      index: i + 1,
      title: PHASE_LABELS[p],
      description: PHASE_BLURBS[p],
      state,
      steps: buildSteps(p),
      onOpen: () => onOpenPhase(p),
    };
  });

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {phases.map((p) => (
          <PhaseCard key={p.phase} phase={p} highlighted={p.phase === currentPhase} />
        ))}
      </div>

      <div>
        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground mb-2">
          Workspace
        </p>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" size="sm" onClick={() => onWorkspace("reports")}>
            Reports
          </Button>
          <Button variant="outline" size="sm" onClick={() => onWorkspace("comparison")}>
            Comparison
          </Button>
          <Button variant="outline" size="sm" onClick={() => onWorkspace("activity")}>
            Activity
          </Button>
        </div>
      </div>
    </div>
  );
}

function PhaseCard({ phase, highlighted }: { phase: HubPhase; highlighted: boolean }) {
  const stateBadge =
    phase.state === "done" ? (
      <Badge variant="outline" className="bg-accent/15 text-accent border-accent/30">Done</Badge>
    ) : phase.state === "active" ? (
      <Badge variant="outline" className="bg-primary/15 text-primary border-primary/30">In progress</Badge>
    ) : (
      <Badge variant="outline" className="text-muted-foreground">Not started</Badge>
    );

  return (
    <Card
      className={cn(
        "transition-shadow hover:shadow-md",
        highlighted && "border-primary/60 ring-1 ring-primary/30",
      )}
    >
      <CardContent className="p-5 space-y-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-3 min-w-0">
            <div
              className={cn(
                "h-9 w-9 shrink-0 rounded-full flex items-center justify-center text-sm font-semibold",
                phase.state === "done"
                  ? "bg-accent/15 text-accent"
                  : phase.state === "active"
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted text-muted-foreground",
              )}
            >
              {phase.state === "done" ? <Check className="h-4 w-4" /> : phase.index}
            </div>
            <div className="min-w-0">
              <h3 className="font-semibold leading-tight truncate">
                Phase {phase.index} · {phase.title}
              </h3>
              <p className="text-xs text-muted-foreground mt-0.5">{phase.description}</p>
            </div>
          </div>
          {stateBadge}
        </div>

        <ul className="space-y-1.5">
          {phase.steps.map((s) => (
            <li key={s.key}>
              <button
                type="button"
                onClick={s.onClick}
                disabled={!s.onClick}
                className={cn(
                  "w-full flex items-center gap-2 rounded-md px-2 py-1.5 text-sm text-left",
                  s.onClick && "hover:bg-muted",
                  !s.onClick && "cursor-default",
                )}
              >
                <StateDot state={s.state ?? "todo"} />
                <span className="flex-1 truncate">{s.label}</span>
                {typeof s.count === "number" && (
                  <span className="text-xs text-muted-foreground tabular-nums">{s.count}</span>
                )}
              </button>
            </li>
          ))}
          {phase.steps.length === 0 && (
            <li className="text-xs text-muted-foreground italic px-2 py-1">No sub-steps</li>
          )}
        </ul>

        <div className="pt-1">
          <Button
            variant={phase.state === "active" ? "default" : "outline"}
            size="sm"
            onClick={phase.onOpen}
            className="w-full"
          >
            Open Phase {phase.index}
            <ArrowRight className="h-4 w-4 ml-2" />
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

// re-export so we don't have to import lucide just for a no-op
export { Circle };
