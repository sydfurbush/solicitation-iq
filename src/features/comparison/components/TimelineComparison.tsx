import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Calendar, AlertTriangle } from "lucide-react";
import { fmtDate } from "../utils/diffHelpers";
import type { DateChange } from "../hooks/usePriorSolicitation";
import { cn } from "@/lib/utils";

function daysBetween(a?: string | null, b?: string | null) {
  if (!a || !b) return null;
  const d1 = new Date(a).getTime();
  const d2 = new Date(b).getTime();
  if (isNaN(d1) || isNaN(d2)) return null;
  return Math.round((d2 - d1) / (1000 * 60 * 60 * 24));
}

export function TimelineComparison({ items }: { items: DateChange[] }) {
  if (items.length === 0) {
    return (
      <Card>
        <CardHeader><CardTitle>Timeline changes</CardTitle></CardHeader>
        <CardContent><p className="text-sm text-muted-foreground py-4 text-center">No timeline changes detected.</p></CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader><CardTitle>Timeline changes</CardTitle></CardHeader>
      <CardContent className="space-y-3">
        {items.map((item, i) => {
          const delta = daysBetween(item.prior, item.current);
          const compressed = delta != null && delta < 0;
          return (
            <div key={i} className="rounded-md border p-3">
              <div className="flex items-center gap-2 mb-2">
                <Calendar className="h-4 w-4 text-muted-foreground" />
                <p className="font-medium text-sm">{item.field}</p>
                {compressed && (
                  <span className="ml-auto inline-flex items-center gap-1 text-destructive text-xs">
                    <AlertTriangle className="h-3 w-3" /> Compressed
                  </span>
                )}
              </div>
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div>
                  <p className="text-xs text-muted-foreground uppercase">Prior</p>
                  <p>{fmtDate(item.prior)}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground uppercase">Current</p>
                  <p>{fmtDate(item.current)}</p>
                </div>
              </div>
              {delta != null && (
                <p className={cn("text-xs mt-2", compressed ? "text-destructive" : "text-emerald-600")}>
                  {delta > 0 ? `+${delta}` : delta} days {compressed ? "(less time)" : "(more time)"}
                </p>
              )}
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}
