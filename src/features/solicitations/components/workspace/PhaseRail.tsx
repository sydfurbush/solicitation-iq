import { useState } from "react";
import { Clock, PanelLeftClose, PanelLeftOpen } from "lucide-react";
import { cn } from "@/lib/utils";
import { PHASES, type PhaseType } from "@/lib/validators/solicitation";
import { format } from "date-fns";

export type RailStep = { key: string; label: string; count?: number };
export type RailPhase = {
  phase: PhaseType;
  label: string;
  steps: RailStep[];
  defaultStep: string;
};

export const RAIL_PHASES: RailPhase[] = [
  {
    phase: "phase_1_initial",
    label: "Initial",
    defaultStep: "overview",
    steps: [
      { key: "overview", label: "Overview" },
      { key: "documents", label: "Documents" },
      { key: "analysis", label: "Analysis" },
      { key: "questions", label: "Questions" },
      { key: "risks", label: "Risks & Opportunities" },
    ],
  },
  {
    phase: "phase_2_deep_dive",
    label: "Deep Dive",
    defaultStep: "rtm",
    steps: [
      { key: "rtm", label: "Requirements (RTM)" },
      { key: "sections", label: "Section analysis" },
      { key: "gaps", label: "Capability gaps" },
      { key: "teaming", label: "Teaming" },
    ],
  },
  {
    phase: "phase_3_outline",
    label: "Outline",
    defaultStep: "outline",
    steps: [
      { key: "outline", label: "Proposal outline" },
      { key: "exhibits", label: "Exhibits & Attachments" },
    ],
  },
  { phase: "phase_4_win_themes", label: "Win Themes", defaultStep: "themes", steps: [] },
  { phase: "phase_5_drafting", label: "Drafting", defaultStep: "draft", steps: [] },
];

const TAB_BY_PHASE: Record<PhaseType, string> = {
  phase_1_initial: "phase-1",
  phase_2_deep_dive: "phase-2",
  phase_3_outline: "phase-3",
  phase_4_win_themes: "phase-4",
  phase_5_drafting: "phase-5",
};

interface Props {
  currentPhase: PhaseType;
  activeTab: string;
  activeStep: string | null;
  onSelect: (tab: string, step?: string) => void;
  proposalDueDate?: string | null;
  daysLeft?: number | null;
  collapsed?: boolean;
  onToggleCollapsed?: () => void;
  counts?: Partial<Record<string, number>>;
}

export function PhaseRail({
  currentPhase,
  activeTab,
  activeStep,
  onSelect,
  proposalDueDate,
  daysLeft,
  collapsed,
  onToggleCollapsed,
  counts,
}: Props) {
  const currentIdx = PHASES.indexOf(currentPhase);
  const progress = Math.round(((currentIdx + 1) / PHASES.length) * 100);

  if (collapsed) {
    return (
      <aside className="w-14 bg-rail text-rail-foreground flex flex-col items-center py-4 gap-2 shrink-0">
        <button
          onClick={onToggleCollapsed}
          className="h-9 w-9 rounded flex items-center justify-center hover:bg-white/10 transition-colors"
          aria-label="Expand phase rail"
        >
          <PanelLeftOpen className="h-4 w-4" />
        </button>
        <div className="w-8 h-px bg-white/10 my-1" />
        {RAIL_PHASES.map((p, i) => {
          const isActive = activeTab === TAB_BY_PHASE[p.phase];
          const done = i < currentIdx;
          return (
            <button
              key={p.phase}
              onClick={() => onSelect(TAB_BY_PHASE[p.phase], p.defaultStep)}
              className={cn(
                "h-9 w-9 rounded-full flex items-center justify-center text-[10px] font-bold transition-all",
                isActive
                  ? "bg-rail-accent text-white"
                  : done
                  ? "bg-white/20 text-white"
                  : "border border-white/20 text-white/60 hover:text-white",
              )}
              aria-label={`Phase ${i + 1}: ${p.label}`}
              title={`Phase ${i + 1}: ${p.label}`}
            >
              {String(i + 1).padStart(2, "0")}
            </button>
          );
        })}
      </aside>
    );
  }

  return (
    <aside className="w-72 bg-rail text-rail-foreground flex flex-col shrink-0">
      <div className="p-6 flex-1 overflow-y-auto">
        <div className="flex items-center justify-between mb-4">
          <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-rail-muted">
            Workflow Phases
          </p>
          {onToggleCollapsed && (
            <button
              onClick={onToggleCollapsed}
              className="h-7 w-7 rounded flex items-center justify-center text-rail-muted hover:text-white hover:bg-white/5 transition-colors"
              aria-label="Collapse phase rail"
            >
              <PanelLeftClose className="h-4 w-4" />
            </button>
          )}
        </div>

        <nav className="space-y-1">
          {RAIL_PHASES.map((p, i) => {
            const tab = TAB_BY_PHASE[p.phase];
            const isActive = activeTab === tab;
            const done = i < currentIdx;
            const num = String(i + 1).padStart(2, "0");
            return (
              <div key={p.phase} className={cn(isActive && "mb-6")}>
                <button
                  onClick={() => onSelect(tab, p.defaultStep)}
                  className={cn(
                    "w-full flex items-center gap-3 p-3 rounded-sm text-left transition-all",
                    isActive
                      ? "bg-white/10 border-l-4 border-rail-accent pl-2"
                      : "text-rail-muted hover:text-white hover:bg-white/5",
                  )}
                >
                  <span
                    className={cn(
                      "flex items-center justify-center w-6 h-6 rounded-full text-[10px] font-bold shrink-0",
                      isActive
                        ? "bg-rail-accent text-white"
                        : done
                        ? "bg-white/20 text-white"
                        : "border border-white/20",
                    )}
                  >
                    {num}
                  </span>
                  <span className={cn("text-sm font-medium", isActive && "text-white")}>
                    Phase {i + 1}: {p.label}
                  </span>
                </button>

                {isActive && p.steps.length > 0 && (
                  <div className="ml-[34px] mt-2 pt-2 pl-4 border-l border-white/10 space-y-3">
                    {p.steps.map((s) => {
                      const sActive = (activeStep ?? p.defaultStep) === s.key;
                      const count = counts?.[s.key];
                      return (
                        <button
                          key={s.key}
                          onClick={() => onSelect(tab, s.key)}
                          className={cn(
                            "w-full flex items-center justify-between text-left text-sm transition-colors relative",
                            sActive
                              ? "text-white font-medium before:absolute before:-left-[17px] before:top-1/2 before:-translate-y-1/2 before:w-1.5 before:h-1.5 before:bg-rail-accent before:rounded-full"
                              : "text-rail-muted hover:text-white",
                          )}
                        >
                          <span>{s.label}</span>
                          {typeof count === "number" && count > 0 && (
                            <span className="text-[10px] text-rail-muted">{count}</span>
                          )}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </nav>
      </div>

      <div className="mt-auto p-6 bg-black/20 space-y-3">
        <div>
          <div className="flex justify-between items-end mb-1.5">
            <span className="text-[10px] uppercase tracking-widest text-rail-muted">Overall Progress</span>
            <span className="text-xs font-bold">{progress}%</span>
          </div>
          <div className="h-1.5 w-full bg-white/10 rounded-full overflow-hidden">
            <div
              className="h-full bg-rail-accent transition-all"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>
        {proposalDueDate && (
          <div className="flex items-start gap-2 pt-2 border-t border-white/10">
            <Clock className="h-3.5 w-3.5 mt-0.5 text-rail-muted shrink-0" />
            <div className="min-w-0">
              <p className="text-[10px] uppercase tracking-widest text-rail-muted">Proposal Due</p>
              <p className="text-sm font-semibold">{format(new Date(proposalDueDate), "MMM d, yyyy")}</p>
              {typeof daysLeft === "number" && (
                <p className={cn(
                  "text-[11px] mt-0.5",
                  daysLeft < 0 ? "text-rose-300" : daysLeft <= 7 ? "text-amber-300" : "text-rail-accent"
                )}>
                  {daysLeft < 0 ? `${Math.abs(daysLeft)} days overdue` : `${daysLeft} days left`}
                </p>
              )}
            </div>
          </div>
        )}
      </div>
    </aside>
  );
}

interface MobileBarProps {
  currentPhase: PhaseType;
  activeTab: string;
  activeStep: string | null;
  onSelect: (tab: string, step?: string) => void;
  onOpenSheet: () => void;
}

export function MobilePhaseBar({ activeTab, activeStep, onSelect, onOpenSheet }: MobileBarProps) {
  const phase = RAIL_PHASES.find((p) => TAB_BY_PHASE[p.phase] === activeTab) ?? RAIL_PHASES[0];
  const idx = RAIL_PHASES.indexOf(phase);
  const sub = activeStep ?? phase.defaultStep;

  return (
    <div className="bg-rail text-rail-foreground sticky top-0 z-20">
      <button
        onClick={onOpenSheet}
        className="w-full flex items-center justify-between px-4 py-3 text-left"
      >
        <div className="flex items-center gap-3 min-w-0">
          <span className="flex items-center justify-center w-7 h-7 rounded-full bg-rail-accent text-[10px] font-bold shrink-0">
            {String(idx + 1).padStart(2, "0")}
          </span>
          <div className="min-w-0">
            <p className="text-[10px] uppercase tracking-widest text-rail-muted">Phase {idx + 1}</p>
            <p className="text-sm font-semibold truncate">{phase.label}</p>
          </div>
        </div>
        <span className="text-xs text-rail-muted">Change ▾</span>
      </button>
      {phase.steps.length > 0 && (
        <div className="flex gap-2 overflow-x-auto px-3 pb-3 snap-x">
          {phase.steps.map((s) => {
            const active = sub === s.key;
            return (
              <button
                key={s.key}
                onClick={() => onSelect(activeTab, s.key)}
                className={cn(
                  "shrink-0 snap-start px-3 py-1.5 rounded-full text-xs font-medium transition-colors whitespace-nowrap",
                  active
                    ? "bg-white text-rail"
                    : "bg-white/10 text-rail-muted hover:bg-white/20 hover:text-white",
                )}
              >
                {s.label}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

interface SheetContentProps {
  currentPhase: PhaseType;
  activeTab: string;
  activeStep: string | null;
  onSelect: (tab: string, step?: string) => void;
  onClose: () => void;
}

export function MobileRailSheet({ currentPhase, activeTab, activeStep, onSelect, onClose }: SheetContentProps) {
  return (
    <div className="bg-rail text-rail-foreground h-full overflow-y-auto p-6">
      <PhaseRail
        currentPhase={currentPhase}
        activeTab={activeTab}
        activeStep={activeStep}
        onSelect={(t, s) => {
          onSelect(t, s);
          onClose();
        }}
        proposalDueDate={null}
        daysLeft={null}
      />
    </div>
  );
}

// Helper hook for localStorage persistence
export function useRailCollapsed() {
  const [collapsed, setCollapsed] = useState<boolean>(() => {
    if (typeof window === "undefined") return false;
    return window.localStorage.getItem("solicitation-rail-collapsed") === "1";
  });
  const toggle = () => {
    setCollapsed((c) => {
      const next = !c;
      try {
        window.localStorage.setItem("solicitation-rail-collapsed", next ? "1" : "0");
      } catch {
        /* ignore */
      }
      return next;
    });
  };
  return { collapsed, toggle };
}
