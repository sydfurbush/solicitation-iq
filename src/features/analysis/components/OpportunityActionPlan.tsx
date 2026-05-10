import { useMemo } from "react";
import { Sparkles } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import {
  OPPORTUNITY_BADGE,
  OPPORTUNITY_LABEL,
  type OpportunityType,
} from "@/features/risks/utils/riskHelpers";
import type { OpportunityRow } from "@/features/opportunities/hooks/useOpportunities";

interface Props {
  opportunities: OpportunityRow[];
}

export function OpportunityActionPlan({ opportunities }: Props) {
  const top = useMemo(
    () => [...opportunities].sort((a, b) => (b.impact_score ?? 0) - (a.impact_score ?? 0)).slice(0, 5),
    [opportunities]
  );

  return (
    <Card>
      <CardContent className="p-5 space-y-4">
        <div className="flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-primary" />
          <h3 className="font-semibold">Opportunity action plan</h3>
        </div>
        {top.length === 0 ? (
          <p className="text-sm text-muted-foreground py-4 text-center">
            No opportunities identified yet.
          </p>
        ) : (
          <ol className="space-y-3">
            {top.map((o, i) => {
              const type = o.opportunity_type as OpportunityType;
              return (
                <li key={o.id} className="rounded-md border p-3 space-y-2">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-xs font-mono text-muted-foreground">#{i + 1}</span>
                    <Badge className={cn("border", OPPORTUNITY_BADGE[type])}>
                      {OPPORTUNITY_LABEL[type]}
                    </Badge>
                    <span className="ml-auto text-sm font-semibold">{o.impact_score ?? 0}/100</span>
                  </div>
                  <p className="font-medium text-sm">{o.title}</p>
                  {o.recommended_approach && (
                    <p className="text-xs text-muted-foreground">{o.recommended_approach}</p>
                  )}
                </li>
              );
            })}
          </ol>
        )}
      </CardContent>
    </Card>
  );
}
