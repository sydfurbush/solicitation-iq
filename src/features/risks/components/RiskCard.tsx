import { format } from "date-fns";
import { CheckCircle2, Pencil, Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import {
  SEVERITY_BADGE,
  SEVERITY_LABEL,
  type RiskSeverity,
} from "@/features/risks/utils/riskHelpers";
import type { RiskRow } from "@/features/risks/hooks/useRisks";

interface RiskCardProps {
  risk: RiskRow;
  onToggleMitigated?: (id: string, next: boolean) => void;
  onEdit?: (risk: RiskRow) => void;
  onDelete?: (risk: RiskRow) => void;
}

export function RiskCard({ risk, onToggleMitigated, onEdit, onDelete }: RiskCardProps) {
  const sev = (risk.severity ?? "medium") as RiskSeverity;
  return (
    <Card>
      <CardContent className="p-5 space-y-3">
        <div className="flex items-start justify-between gap-3">
          <div className="space-y-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <Badge className={cn("border capitalize", SEVERITY_BADGE[sev])}>
                {SEVERITY_LABEL[sev]}
              </Badge>
              {!risk.is_ai_generated && (
                <Badge variant="outline" className="text-[10px]">Manual</Badge>
              )}
            </div>
            <h3 className="font-semibold leading-snug">{risk.title}</h3>
          </div>
          <div className="flex gap-1 shrink-0">
            {onEdit && (
              <Button size="icon" variant="ghost" onClick={() => onEdit(risk)}>
                <Pencil className="h-4 w-4" />
              </Button>
            )}
            {onDelete && (
              <Button size="icon" variant="ghost" onClick={() => onDelete(risk)}>
                <Trash2 className="h-4 w-4" />
              </Button>
            )}
          </div>
        </div>

        <p className="text-sm text-muted-foreground whitespace-pre-line">{risk.description}</p>

        {risk.source_citation && (
          <div className="text-xs">
            <span className="font-medium text-muted-foreground">Source: </span>
            <span className="text-primary">{risk.source_citation}</span>
          </div>
        )}
        {risk.source_quote && (
          <blockquote className="border-l-2 border-muted pl-3 text-sm italic text-muted-foreground">
            "{risk.source_quote}"
          </blockquote>
        )}

        <div className="rounded-md border bg-muted/30 p-3">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground mb-1">
            Mitigation
          </p>
          {risk.is_mitigated ? (
            <div className="flex items-center gap-2 text-sm text-green-600 dark:text-green-400">
              <CheckCircle2 className="h-4 w-4" />
              <span>
                Mitigated{" "}
                {risk.updated_at && (
                  <span className="text-muted-foreground">
                    on {format(new Date(risk.updated_at), "PP")}
                  </span>
                )}
              </span>
              {onToggleMitigated && (
                <Button
                  size="sm"
                  variant="ghost"
                  className="ml-auto"
                  onClick={() => onToggleMitigated(risk.id, false)}
                >
                  Reopen
                </Button>
              )}
            </div>
          ) : (
            <div className="space-y-2">
              <p className="text-sm">
                {risk.mitigation_strategy ?? (
                  <span className="text-muted-foreground italic">No strategy yet.</span>
                )}
              </p>
              {onToggleMitigated && (
                <Button size="sm" onClick={() => onToggleMitigated(risk.id, true)}>
                  <CheckCircle2 className="h-4 w-4 mr-2" /> Mark mitigated
                </Button>
              )}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
