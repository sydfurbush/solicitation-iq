import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Lightbulb, AlertTriangle, Building2, Users, Target, Flag } from "lucide-react";
import type { Insight } from "../hooks/usePriorSolicitation";

const ICONS = {
  agency: Building2,
  incumbent: Users,
  competitor: Target,
  risk: AlertTriangle,
  opportunity: Lightbulb,
  strategy: Flag,
} as const;

export function ComparisonInsights({ insights, recommendations }: { insights: Insight[]; recommendations: string[] }) {
  return (
    <div className="grid lg:grid-cols-2 gap-4">
      <Card>
        <CardHeader><CardTitle>Strategic insights</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          {insights.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4 text-center">No insights generated.</p>
          ) : (
            insights.map((insight, i) => {
              const Icon = ICONS[insight.category ?? "strategy"] ?? Lightbulb;
              return (
                <div key={i} className="rounded-md border p-3">
                  <div className="flex items-start gap-3">
                    <div className="rounded-md bg-primary/10 text-primary p-2">
                      <Icon className="h-4 w-4" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="font-medium">{insight.title}</p>
                        {insight.category && <Badge variant="outline" className="capitalize text-xs">{insight.category}</Badge>}
                      </div>
                      <p className="text-sm text-muted-foreground mt-1">{insight.detail}</p>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Recommended response</CardTitle></CardHeader>
        <CardContent>
          {recommendations.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4 text-center">No recommendations generated.</p>
          ) : (
            <ul className="space-y-2 text-sm">
              {recommendations.map((rec, i) => (
                <li key={i} className="flex gap-2">
                  <span className="text-primary">→</span>
                  <span>{rec}</span>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
