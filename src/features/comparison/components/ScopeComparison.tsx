import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Plus, Minus, Pencil } from "lucide-react";
import { ComparisonDiffViewer } from "./ComparisonDiffViewer";
import type { ChangeItem } from "../hooks/usePriorSolicitation";

export function ScopeComparison({ items, summary }: { items: ChangeItem[]; summary?: string | null }) {
  return (
    <Card>
      <CardHeader><CardTitle>Scope changes</CardTitle></CardHeader>
      <CardContent className="space-y-3">
        {summary && <p className="text-sm rounded-md bg-muted/30 border p-3">{summary}</p>}
        {items.length === 0 ? (
          <p className="text-sm text-muted-foreground py-4 text-center">No scope changes detected.</p>
        ) : (
          items.map((item, i) => {
            const Icon = item.type === "added" ? Plus : item.type === "removed" ? Minus : Pencil;
            return (
              <details key={i} className="rounded-md border p-3 group">
                <summary className="flex items-center gap-2 cursor-pointer">
                  <Icon className="h-4 w-4" />
                  <Badge variant="outline" className="capitalize">{item.type}</Badge>
                  <span className="text-sm font-medium truncate">{item.text.slice(0, 100)}</span>
                </summary>
                <div className="mt-3">
                  {item.type === "modified" && item.prior_text ? (
                    <ComparisonDiffViewer oldText={item.prior_text} newText={item.text} mode="side-by-side" />
                  ) : (
                    <p className="text-sm whitespace-pre-wrap">{item.text}</p>
                  )}
                  {item.citation && <p className="text-xs text-muted-foreground mt-2">{item.citation}</p>}
                </div>
              </details>
            );
          })
        )}
      </CardContent>
    </Card>
  );
}
