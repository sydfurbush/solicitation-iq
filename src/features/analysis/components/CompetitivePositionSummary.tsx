import { useMemo } from "react";
import { Trophy } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import type { RiskRow } from "@/features/risks/hooks/useRisks";
import type { OpportunityRow } from "@/features/opportunities/hooks/useOpportunities";

interface Props {
  risks: RiskRow[];
  opportunities: OpportunityRow[];
}

const SEVERITY_WEIGHT: Record<string, number> = {
  critical: 25,
  high: 15,
  medium: 8,
  low: 3,
  informational: 1,
};

export function CompetitivePositionSummary({ risks, opportunities }: Props) {
  const { winProbability, hasData, strengths, weaknesses, positioning } = useMemo(() => {
    const hasData = opportunities.length > 0 || risks.length > 0;

    const oppLift = opportunities.length
      ? opportunities.reduce((s, o) => s + (o.impact_score ?? 0), 0) / opportunities.length
      : 0;

    const rawRiskDrag = risks
      .filter((r) => !r.is_mitigated)
      .reduce((s, r) => s + (SEVERITY_WEIGHT[r.severity ?? "medium"] ?? 5), 0);
    const riskDrag = Math.min(60, rawRiskDrag);

    const normalized = Math.max(0, Math.min(100, Math.round(oppLift - riskDrag)));

    const strengths = [...opportunities]
      .sort((a, b) => (b.impact_score ?? 0) - (a.impact_score ?? 0))
      .slice(0, 3)
      .map((o) => o.title);

    const weaknesses = [...risks]
      .filter((r) => !r.is_mitigated)
      .sort(
        (a, b) =>
          (SEVERITY_WEIGHT[b.severity ?? "medium"] ?? 0) -
          (SEVERITY_WEIGHT[a.severity ?? "medium"] ?? 0)
      )
      .slice(0, 3)
      .map((r) => r.title);

    let positioning = "Maintain a balanced posture and address open risks before submission.";
    if (normalized >= 65) {
      positioning = "Position aggressively — emphasize differentiators and innovation themes.";
    } else if (normalized >= 45) {
      positioning = "Lean into top opportunities while neutralizing high-severity risks.";
    } else if (normalized < 30) {
      positioning = "Reassess pursuit — high-severity risks materially threaten win probability.";
    }

    return { winProbability: normalized, hasData, strengths, weaknesses, positioning };
  }, [risks, opportunities]);

  return (
    <Card>
      <CardContent className="p-5 space-y-4">
        <div className="flex items-center gap-2">
          <Trophy className="h-4 w-4 text-primary" />
          <h3 className="font-semibold">Competitive position</h3>
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <p className="text-xs text-muted-foreground uppercase tracking-wide">Win probability indicator</p>
            <span className="text-2xl font-bold">{hasData ? `${winProbability}%` : "—"}</span>
          </div>
          <Progress value={hasData ? winProbability : 0} className="h-2" />
          <p className="text-xs text-muted-foreground">
            {hasData
              ? "Estimate combines average opportunity impact with unmitigated risk severity. Not a forecast."
              : "Identify risks & opportunities to see a position estimate."}
          </p>
        </div>

        <div className="grid md:grid-cols-2 gap-4">
          <div className="space-y-1">
            <p className="text-xs font-medium uppercase tracking-wide text-emerald-600">Strengths</p>
            {strengths.length === 0 ? (
              <p className="text-sm text-muted-foreground">None identified.</p>
            ) : (
              <ul className="text-sm space-y-1 list-disc pl-4">
                {strengths.map((s, i) => <li key={i}>{s}</li>)}
              </ul>
            )}
          </div>
          <div className="space-y-1">
            <p className="text-xs font-medium uppercase tracking-wide text-red-600">Weaknesses</p>
            {weaknesses.length === 0 ? (
              <p className="text-sm text-muted-foreground">None identified.</p>
            ) : (
              <ul className="text-sm space-y-1 list-disc pl-4">
                {weaknesses.map((s, i) => <li key={i}>{s}</li>)}
              </ul>
            )}
          </div>
        </div>

        {hasData && (
          <div className="rounded-md border bg-muted/30 p-3">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground mb-1">
              Recommended positioning
            </p>
            <p className="text-sm">{positioning}</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
