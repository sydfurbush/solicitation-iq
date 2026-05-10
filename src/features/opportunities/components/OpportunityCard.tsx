import { Pencil, Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";
import {
  OPPORTUNITY_BADGE,
  OPPORTUNITY_LABEL,
  impactLevel,
  type OpportunityType,
} from "@/features/risks/utils/riskHelpers";
import type { OpportunityRow } from "@/features/opportunities/hooks/useOpportunities";

interface Props {
  opportunity: OpportunityRow;
  onEdit?: (o: OpportunityRow) => void;
  onDelete?: (o: OpportunityRow) => void;
}

export function OpportunityCard({ opportunity: o, onEdit, onDelete }: Props) {
  const type = o.opportunity_type as OpportunityType;
  const score = o.impact_score ?? 50;
  const lvl = impactLevel(score);
  return (
    <Card>
      <CardContent className="p-5 space-y-3">
        <div className="flex items-start justify-between gap-3">
          <div className="space-y-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <Badge className={cn("border", OPPORTUNITY_BADGE[type])}>
                {OPPORTUNITY_LABEL[type]}
              </Badge>
              {!o.is_ai_generated && (
                <Badge variant="outline" className="text-[10px]">Manual</Badge>
              )}
            </div>
            <h3 className="font-semibold leading-snug">{o.title}</h3>
          </div>
          <div className="flex gap-1 shrink-0">
            {onEdit && (
              <Button size="icon" variant="ghost" onClick={() => onEdit(o)}>
                <Pencil className="h-4 w-4" />
              </Button>
            )}
            {onDelete && (
              <Button size="icon" variant="ghost" onClick={() => onDelete(o)}>
                <Trash2 className="h-4 w-4" />
              </Button>
            )}
          </div>
        </div>

        <div className="space-y-1">
          <div className="flex items-center justify-between text-xs">
            <span className="text-muted-foreground uppercase tracking-wide">Impact</span>
            <span className={cn(
              "font-semibold",
              lvl === "high" ? "text-emerald-600" : lvl === "medium" ? "text-amber-600" : "text-muted-foreground"
            )}>
              {score}/100
            </span>
          </div>
          <Progress value={score} className="h-2" />
        </div>

        <p className="text-sm text-muted-foreground whitespace-pre-line">{o.description}</p>

        {o.source_citation && (
          <div className="text-xs">
            <span className="font-medium text-muted-foreground">Source: </span>
            <span className="text-primary">{o.source_citation}</span>
          </div>
        )}
        {o.source_quote && (
          <blockquote className="border-l-2 border-muted pl-3 text-sm italic text-muted-foreground">
            "{o.source_quote}"
          </blockquote>
        )}

        {o.recommended_approach && (
          <div className="rounded-md border bg-muted/30 p-3 space-y-1">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Recommended approach
            </p>
            <p className="text-sm">{o.recommended_approach}</p>
          </div>
        )}
        {o.client_capability_match && (
          <div className="rounded-md border bg-muted/30 p-3 space-y-1">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Client capability match
            </p>
            <p className="text-sm">{o.client_capability_match}</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
