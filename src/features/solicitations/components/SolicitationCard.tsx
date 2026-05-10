import { useNavigate } from "react-router-dom";
import { format } from "date-fns";
import { AlertTriangle, FileText, HelpCircle, ShieldAlert, Clock } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import {
  STATUS_CLASSES,
  STATUS_LABELS,
  dueUrgency,
  daysUntil,
  formatRange,
} from "../lib/format";
import { PhaseIndicator } from "./PhaseIndicator";
import type { SolicitationWithClient } from "../hooks/useSolicitations";
import type { SolicitationStatus } from "@/lib/validators/solicitation";

interface Props {
  solicitation: SolicitationWithClient;
}

function clientInitials(name: string) {
  return name
    .split(/\s+/)
    .map((p) => p[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

export function SolicitationCard({ solicitation: s }: Props) {
  const navigate = useNavigate();
  const status = (s.status ?? "intake") as SolicitationStatus;
  const urgency = dueUrgency(s.proposal_due_date);
  const days = daysUntil(s.proposal_due_date);

  return (
    <Card
      onClick={() => navigate(`/solicitations/${s.id}`)}
      className="cursor-pointer transition-all hover:shadow-md hover:-translate-y-0.5"
    >
      <CardContent className="p-5 space-y-4">
        <div className="flex items-center gap-2">
          <Avatar className="h-7 w-7">
            {s.client?.logo_url ? (
              <AvatarImage src={s.client.logo_url} alt={s.client.name} />
            ) : null}
            <AvatarFallback className="bg-primary/10 text-primary text-[10px]">
              {clientInitials(s.client?.name ?? "?")}
            </AvatarFallback>
          </Avatar>
          <span className="text-xs font-medium text-muted-foreground truncate">
            {s.client?.name ?? "Unknown client"}
          </span>
          <Badge variant="outline" className={cn("ml-auto capitalize", STATUS_CLASSES[status])}>
            {STATUS_LABELS[status]}
          </Badge>
        </div>

        <div>
          <h3 className="font-semibold leading-snug line-clamp-2">{s.title}</h3>
          <div className="mt-1.5 flex items-center gap-2 flex-wrap">
            {s.solicitation_number && (
              <Badge variant="secondary" className="font-mono text-[10px]">
                {s.solicitation_number}
              </Badge>
            )}
            {s.issuing_agency && (
              <span className="text-xs text-muted-foreground truncate">
                {s.issuing_agency}
              </span>
            )}
          </div>
        </div>

        <PhaseIndicator current={s.current_phase} status={s.status} compact />

        <div className="flex items-center justify-between text-xs">
          <div
            className={cn(
              "inline-flex items-center gap-1.5",
              urgency === "danger" || urgency === "overdue"
                ? "text-destructive font-medium"
                : urgency === "warning"
                  ? "text-amber-600 dark:text-amber-500 font-medium"
                  : "text-muted-foreground"
            )}
          >
            {urgency === "danger" || urgency === "overdue" ? (
              <AlertTriangle className="h-3.5 w-3.5" />
            ) : (
              <Clock className="h-3.5 w-3.5" />
            )}
            {s.proposal_due_date ? (
              <>
                {format(new Date(s.proposal_due_date), "MMM d")}
                {days !== null && (
                  <span>
                    {" · "}
                    {days < 0 ? `${Math.abs(days)}d overdue` : `${days}d left`}
                  </span>
                )}
              </>
            ) : (
              "No due date"
            )}
          </div>
          <span className="text-muted-foreground font-medium">
            {formatRange(s.estimated_value_low, s.estimated_value_high)}
          </span>
        </div>

        <div className="flex items-center gap-3 pt-2 border-t text-xs text-muted-foreground">
          <span className="inline-flex items-center gap-1">
            <FileText className="h-3.5 w-3.5" /> {s.documents_count}
          </span>
          <span className="inline-flex items-center gap-1">
            <HelpCircle className="h-3.5 w-3.5" /> {s.questions_count}
          </span>
          <span className="inline-flex items-center gap-1">
            <ShieldAlert className="h-3.5 w-3.5" /> {s.risks_count}
          </span>
        </div>
      </CardContent>
    </Card>
  );
}
