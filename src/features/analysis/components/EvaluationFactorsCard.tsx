import { Scale } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { CitationLink } from "./CitationLink";
import type { AnalysisEvaluationFactor } from "../prompts/solicitationAnalysis";

interface Props {
  factors: AnalysisEvaluationFactor[];
}

export function EvaluationFactorsCard({ factors }: Props) {
  const totalWeight = factors.reduce((sum, f) => sum + (f.weight ?? 0), 0);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Scale className="h-4 w-4 text-primary" />
          Evaluation factors
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {factors.length === 0 ? (
          <p className="text-sm text-muted-foreground italic py-4 text-center">No evaluation factors detected.</p>
        ) : (
          factors.map((f, i) => {
            const pct = totalWeight && f.weight ? Math.round((f.weight / totalWeight) * 100) : null;
            return (
              <div key={i} className="space-y-1.5">
                <div className="flex items-baseline justify-between gap-2">
                  <p className="font-medium text-sm">{f.name}</p>
                  {f.weight != null && (
                    <span className="text-xs text-muted-foreground tabular-nums">
                      {f.weight}{pct ? ` pts · ${pct}%` : ""}
                    </span>
                  )}
                </div>
                {f.weight != null && totalWeight > 0 && (
                  <Progress value={(f.weight / totalWeight) * 100} className="h-1.5" />
                )}
                {f.description && <p className="text-xs text-muted-foreground">{f.description}</p>}
                {f.subfactors && f.subfactors.length > 0 && (
                  <ul className="text-xs text-muted-foreground list-disc pl-4">
                    {f.subfactors.map((s, j) => <li key={j}>{s}</li>)}
                  </ul>
                )}
                {f.source && (
                  <CitationLink
                    document={f.source.document}
                    section={f.source.section}
                    page={f.source.page}
                    quote={f.source.quote}
                  />
                )}
              </div>
            );
          })
        )}
      </CardContent>
    </Card>
  );
}
