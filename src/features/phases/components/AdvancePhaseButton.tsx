import { ArrowRight, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "@/hooks/use-toast";
import { PHASES, type PhaseType } from "@/lib/validators/solicitation";
import { nextPhase, useAdvancePhase, PHASE_TAB } from "@/features/solicitations/hooks/usePhaseProgression";
import { useSearchParams } from "react-router-dom";

const PHASE_LABELS: Record<PhaseType, string> = {
  phase_1_initial: "Initial",
  phase_2_deep_dive: "Deep Dive",
  phase_3_outline: "Outline",
  phase_4_win_themes: "Win Themes",
};

export function AdvancePhaseButton({
  solicitationId,
  currentPhase,
  className,
}: {
  solicitationId: string;
  currentPhase: PhaseType;
  className?: string;
}) {
  const target = nextPhase(currentPhase);
  const advance = useAdvancePhase(solicitationId);
  const [, setSearchParams] = useSearchParams();

  if (!target) {
    return (
      <div className={className}>
        <Button disabled variant="outline" size="sm">
          <Check className="h-4 w-4 mr-2" /> Final phase reached
        </Button>
      </div>
    );
  }

  const handle = async () => {
    try {
      await advance.mutateAsync({ from: currentPhase, to: target });
      toast({ title: "Phase advanced", description: `Now in ${PHASE_LABELS[target]}` });
      setSearchParams({ tab: PHASE_TAB[target] });
    } catch (e) {
      toast({
        title: "Failed to advance phase",
        description: e instanceof Error ? e.message : String(e),
        variant: "destructive",
      });
    }
  };

  return (
    <div className={className}>
      <Button onClick={handle} disabled={advance.isPending}>
        Mark {PHASE_LABELS[currentPhase]} complete & advance to {PHASE_LABELS[target]}
        <ArrowRight className="h-4 w-4 ml-2" />
      </Button>
    </div>
  );
}

export { PHASES };
