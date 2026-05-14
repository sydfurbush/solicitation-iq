import { useState } from "react";
import { ArrowRight, Check, ShieldAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "@/hooks/use-toast";
import { PHASES, type PhaseType } from "@/lib/validators/solicitation";
import { nextPhase, useAdvancePhase, PHASE_TAB } from "@/features/solicitations/hooks/usePhaseProgression";
import { useSearchParams } from "react-router-dom";
import { usePhaseApprovals } from "@/features/phases/hooks/usePhaseApprovals";
import { useUser } from "@/features/auth/hooks/useUser";

const PHASE_LABELS: Record<PhaseType, string> = {
  phase_1_initial: "Initial",
  phase_2_deep_dive: "Deep Dive",
  phase_3_outline: "Outline",
  phase_4_win_themes: "Win Themes",
  phase_5_drafting: "Drafting",
};

const GATED: PhaseType[] = ["phase_1_initial", "phase_2_deep_dive", "phase_3_outline"];

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
  const { byPhase } = usePhaseApprovals(solicitationId);
  const { role } = useUser();
  const [override, setOverride] = useState(false);

  if (!target) {
    return (
      <div className={className}>
        <Button disabled variant="outline" size="sm">
          <Check className="h-4 w-4 mr-2" /> Final phase reached
        </Button>
      </div>
    );
  }

  const isGated = GATED.includes(currentPhase);
  const approvalStatus = byPhase[currentPhase]?.status;
  const gateOk = !isGated || approvalStatus === "approved";
  const canOverride = role === "owner" || role === "admin";
  const blocked = !gateOk && !override;

  const handle = async () => {
    try {
      await advance.mutateAsync({ from: currentPhase, to: target, override });
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
      <div className="flex flex-wrap items-center gap-3">
        <Button onClick={handle} disabled={advance.isPending || blocked}>
          Mark {PHASE_LABELS[currentPhase]} complete & advance to {PHASE_LABELS[target]}
          <ArrowRight className="h-4 w-4 ml-2" />
        </Button>
        {!gateOk && canOverride && (
          <label className="flex items-center gap-2 text-xs text-muted-foreground cursor-pointer">
            <Checkbox checked={override} onCheckedChange={(v) => setOverride(!!v)} />
            <ShieldAlert className="h-3.5 w-3.5" /> Override (no client approval)
          </label>
        )}
      </div>
      {!gateOk && (
        <p className="text-xs text-muted-foreground mt-2">
          {approvalStatus === "pending_review"
            ? "Awaiting client approval."
            : approvalStatus === "changes_requested"
              ? "Client requested changes — address them and reopen for review."
              : "Request client approval from the Workflow tab to proceed."}
        </p>
      )}
    </div>
  );
}

export { PHASES };
