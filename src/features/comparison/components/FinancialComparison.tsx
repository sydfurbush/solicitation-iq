import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DollarSign } from "lucide-react";
import type { FinancialChange } from "../hooks/usePriorSolicitation";

export function FinancialComparison({ items }: { items: FinancialChange[] }) {
  if (items.length === 0) {
    return (
      <Card>
        <CardHeader><CardTitle>Financial changes</CardTitle></CardHeader>
        <CardContent><p className="text-sm text-muted-foreground py-4 text-center">No financial changes detected.</p></CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader><CardTitle>Financial changes</CardTitle></CardHeader>
      <CardContent className="space-y-3">
        {items.map((item, i) => {
          const priorN = parseFloat(String(item.prior ?? "").replace(/[^0-9.]/g, ""));
          const currN = parseFloat(String(item.current ?? "").replace(/[^0-9.]/g, ""));
          const max = Math.max(priorN || 0, currN || 0, 1);
          return (
            <div key={i} className="rounded-md border p-3">
              <div className="flex items-center gap-2 mb-3">
                <DollarSign className="h-4 w-4 text-muted-foreground" />
                <p className="font-medium text-sm">{item.field}</p>
                {item.delta && <span className="ml-auto text-xs text-muted-foreground">{item.delta}</span>}
              </div>
              <div className="space-y-2">
                <Bar label={`Prior: ${item.prior ?? "—"}`} value={priorN || 0} max={max} tone="muted" />
                <Bar label={`Current: ${item.current ?? "—"}`} value={currN || 0} max={max} tone="primary" />
              </div>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}

function Bar({ label, value, max, tone }: { label: string; value: number; max: number; tone: "muted" | "primary" }) {
  const pct = Math.min(100, (value / max) * 100);
  return (
    <div>
      <p className="text-xs mb-1">{label}</p>
      <div className="h-3 bg-muted rounded-full overflow-hidden">
        <div className={tone === "primary" ? "h-full bg-primary" : "h-full bg-muted-foreground/40"} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}
