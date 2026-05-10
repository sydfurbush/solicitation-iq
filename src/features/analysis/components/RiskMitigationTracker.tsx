import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { CheckCircle2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { useState } from "react";
import { cn } from "@/lib/utils";
import {
  SEVERITY_BADGE,
  SEVERITY_LABEL,
  type RiskSeverity,
} from "@/features/risks/utils/riskHelpers";
import {
  useUpdateRisk,
  useMarkRiskMitigated,
  type RiskRow,
} from "@/features/risks/hooks/useRisks";

interface Props {
  solicitationId: string;
  risks: RiskRow[];
}

export function RiskMitigationTracker({ solicitationId, risks }: Props) {
  const updateRisk = useUpdateRisk(solicitationId);
  const markMitigated = useMarkRiskMitigated(solicitationId);
  const total = risks.length;
  const mitigated = risks.filter((r) => r.is_mitigated).length;
  const open = risks.filter((r) => !r.is_mitigated);
  const pct = total ? Math.round((mitigated / total) * 100) : 0;

  return (
    <Card>
      <CardContent className="p-5 space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="font-semibold">Risk mitigation</h3>
            <p className="text-xs text-muted-foreground">
              {mitigated} of {total} risks mitigated
            </p>
          </div>
          <span className="text-2xl font-bold">{pct}%</span>
        </div>
        <Progress value={pct} className="h-2" />

        {open.length === 0 ? (
          <p className="text-sm text-center text-muted-foreground py-6">
            All risks have been mitigated.
          </p>
        ) : (
          <div className="space-y-3">
            {open.map((r) => (
              <UnmitigatedRow
                key={r.id}
                risk={r}
                onSaveStrategy={(strategy) =>
                  updateRisk.mutate({ id: r.id, updates: { mitigation_strategy: strategy } })
                }
                onMarkMitigated={() => markMitigated.mutate({ id: r.id, isMitigated: true })}
              />
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function UnmitigatedRow({
  risk,
  onSaveStrategy,
  onMarkMitigated,
}: {
  risk: RiskRow;
  onSaveStrategy: (s: string) => void;
  onMarkMitigated: () => void;
}) {
  const [strategy, setStrategy] = useState(risk.mitigation_strategy ?? "");
  const sev = (risk.severity ?? "medium") as RiskSeverity;
  return (
    <div className="rounded-md border p-3 space-y-2">
      <div className="flex items-start justify-between gap-2">
        <div className="space-y-1 min-w-0">
          <div className="flex items-center gap-2">
            <Badge className={cn("border", SEVERITY_BADGE[sev])}>{SEVERITY_LABEL[sev]}</Badge>
          </div>
          <p className="font-medium text-sm">{risk.title}</p>
        </div>
      </div>
      <Textarea
        rows={2}
        value={strategy}
        onChange={(e) => setStrategy(e.target.value)}
        placeholder="Mitigation notes…"
      />
      <div className="flex justify-end gap-2">
        <Button
          size="sm"
          variant="outline"
          onClick={() => onSaveStrategy(strategy)}
          disabled={strategy === (risk.mitigation_strategy ?? "")}
        >
          Save notes
        </Button>
        <Button size="sm" onClick={onMarkMitigated}>
          <CheckCircle2 className="h-4 w-4 mr-2" /> Mark mitigated
        </Button>
      </div>
    </div>
  );
}
