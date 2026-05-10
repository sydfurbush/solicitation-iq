import { useMemo } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import {
  SEVERITY_LABEL,
  SEVERITY_ORDER,
  type RiskSeverity,
} from "@/features/risks/utils/riskHelpers";
import type { RiskRow } from "@/features/risks/hooks/useRisks";

interface Props {
  risks: RiskRow[];
  onCellClick?: (severity: RiskSeverity, status: "open" | "mitigated") => void;
}

export function RiskHeatmap({ risks, onCellClick }: Props) {
  const buckets = useMemo(() => {
    const map: Record<RiskSeverity, { open: number; mitigated: number }> = {
      critical: { open: 0, mitigated: 0 },
      high: { open: 0, mitigated: 0 },
      medium: { open: 0, mitigated: 0 },
      low: { open: 0, mitigated: 0 },
      informational: { open: 0, mitigated: 0 },
    };
    risks.forEach((r) => {
      const sev = (r.severity ?? "medium") as RiskSeverity;
      if (r.is_mitigated) map[sev].mitigated += 1;
      else map[sev].open += 1;
    });
    return map;
  }, [risks]);

  const max = Math.max(
    1,
    ...SEVERITY_ORDER.flatMap((s) => [buckets[s].open, buckets[s].mitigated])
  );

  const intensity = (count: number, sev: RiskSeverity) => {
    if (count === 0) return "bg-muted/40 text-muted-foreground";
    const ratio = count / max;
    const base =
      sev === "critical" ? "bg-red-600" :
      sev === "high" ? "bg-red-500" :
      sev === "medium" ? "bg-amber-500" :
      sev === "low" ? "bg-yellow-500" :
      "bg-blue-500";
    const opacity =
      ratio > 0.75 ? "opacity-100" :
      ratio > 0.5 ? "opacity-80" :
      ratio > 0.25 ? "opacity-60" :
      "opacity-40";
    return cn(base, opacity, "text-white");
  };

  return (
    <Card>
      <CardContent className="p-5">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="font-semibold">Risk heatmap</h3>
            <p className="text-xs text-muted-foreground">Severity vs. mitigation status</p>
          </div>
          <p className="text-xs text-muted-foreground">{risks.length} total</p>
        </div>
        <div className="grid grid-cols-[120px_1fr_1fr] gap-2 text-sm">
          <div />
          <div className="text-center text-xs font-medium text-muted-foreground">Open</div>
          <div className="text-center text-xs font-medium text-muted-foreground">Mitigated</div>
          {SEVERITY_ORDER.map((sev) => (
            <div className="contents" key={sev}>
              <div className="text-xs font-medium flex items-center">{SEVERITY_LABEL[sev]}</div>
              {(["open", "mitigated"] as const).map((status) => {
                const count = buckets[sev][status];
                return (
                  <button
                    key={status}
                    type="button"
                    onClick={() => onCellClick?.(sev, status)}
                    className={cn(
                      "h-12 rounded-md flex items-center justify-center font-semibold transition hover:scale-[1.02]",
                      intensity(count, sev)
                    )}
                  >
                    {count}
                  </button>
                );
              })}
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
