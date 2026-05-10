import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ArrowRight } from "lucide-react";
import type { EvalFactorChange } from "../hooks/usePriorSolicitation";

function parseWeight(w?: string | null): number | null {
  if (!w) return null;
  const m = String(w).match(/(\d+(\.\d+)?)/);
  return m ? parseFloat(m[1]) : null;
}

export function EvaluationFactorsComparison({ items }: { items: EvalFactorChange[] }) {
  if (items.length === 0) {
    return (
      <Card>
        <CardHeader><CardTitle>Evaluation factor changes</CardTitle></CardHeader>
        <CardContent><p className="text-sm text-muted-foreground py-4 text-center">No evaluation factor changes detected.</p></CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader><CardTitle>Evaluation factor changes</CardTitle></CardHeader>
      <CardContent className="space-y-3">
        {items.map((item, i) => {
          const priorW = parseWeight(item.prior_weight);
          const currW = parseWeight(item.current_weight);
          const max = Math.max(priorW ?? 0, currW ?? 0, 1);
          const tone =
            item.type === "added" ? "border-emerald-500/30 bg-emerald-500/5"
              : item.type === "removed" ? "border-destructive/30 bg-destructive/5"
              : "border-amber-500/30 bg-amber-500/5";
          return (
            <div key={i} className={`rounded-md border p-3 ${tone}`}>
              <div className="flex items-center gap-2 mb-2">
                <Badge variant="outline" className="capitalize">{item.type.replace("_", " ")}</Badge>
                <p className="font-medium">{item.factor}</p>
              </div>

              {(priorW != null || currW != null) && (
                <div className="grid grid-cols-2 gap-3 text-xs">
                  <WeightBar label={`Prior: ${item.prior_weight ?? "—"}`} value={priorW ?? 0} max={max} tone="muted" />
                  <WeightBar label={`Current: ${item.current_weight ?? "—"}`} value={currW ?? 0} max={max} tone="primary" />
                </div>
              )}
              {priorW != null && currW != null && priorW !== currW && (
                <p className="text-xs text-muted-foreground mt-2 flex items-center gap-1">
                  <ArrowRight className="h-3 w-3" /> Δ {(currW - priorW > 0 ? "+" : "") + (currW - priorW).toFixed(1)}
                </p>
              )}
              {item.notes && <p className="text-sm text-muted-foreground mt-2">{item.notes}</p>}
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}

function WeightBar({ label, value, max, tone }: { label: string; value: number; max: number; tone: "muted" | "primary" }) {
  const pct = Math.min(100, (value / max) * 100);
  return (
    <div>
      <p className="mb-1">{label}</p>
      <div className="h-2 bg-muted rounded-full overflow-hidden">
        <div className={tone === "primary" ? "h-full bg-primary" : "h-full bg-muted-foreground/40"} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}
