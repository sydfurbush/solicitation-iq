import { useNavigate } from "react-router-dom";
import { format } from "date-fns";
import { AlertTriangle, Archive, FileText, HelpCircle, MoreVertical, RotateCcw, ShieldAlert, Clock, Trash2 } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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
  onArchive?: (s: SolicitationWithClient) => void;
  onDelete?: (s: SolicitationWithClient) => void;
  onRestore?: (s: SolicitationWithClient) => void;
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

export function SolicitationCard({ solicitation: s, onArchive, onDelete, onRestore }: Props) {
  const navigate = useNavigate();
  const status = (s.status ?? "intake") as SolicitationStatus;
  const urgency = dueUrgency(s.proposal_due_date);
  const days = daysUntil(s.proposal_due_date);
  const setAside = (s as { set_aside?: string | null }).set_aside;
  const isDeleted = !!s.deleted_at;
  const hasMenu = !!(onArchive || onDelete || onRestore);

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
          {hasMenu && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 -mr-1"
                  onClick={(e) => e.stopPropagation()}
                  aria-label="Solicitation actions"
                >
                  <MoreVertical className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" onClick={(e) => e.stopPropagation()}>
                {onArchive && (
                  <DropdownMenuItem onClick={() => onArchive(s)}>
                    <Archive className="mr-2 h-4 w-4" /> Archive
                  </DropdownMenuItem>
                )}
                {onArchive && onDelete && <DropdownMenuSeparator />}
                {onDelete && (
                  <DropdownMenuItem
                    onClick={() => onDelete(s)}
                    className="text-destructive focus:text-destructive"
                  >
                    <Trash2 className="mr-2 h-4 w-4" /> Delete
                  </DropdownMenuItem>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>

        <div>
          <h3 className="font-semibold leading-snug line-clamp-2">{s.title}</h3>
          <div className="mt-1.5 flex items-center gap-2 flex-wrap">
            {s.solicitation_number && (
              <Badge variant="secondary" className="font-mono text-[10px]">
                {s.solicitation_number}
              </Badge>
            )}
            {setAside && (
              <Badge variant="outline" className="text-[10px]">
                {setAside}
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
