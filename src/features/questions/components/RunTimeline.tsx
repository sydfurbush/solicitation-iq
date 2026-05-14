import { format } from "date-fns";
import {
  AlertTriangle,
  CheckCircle2,
  Loader2,
  PlayCircle,
  XCircle,
  Layers,
  Network,
} from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import { useQuestionRunEvents, type QuestionRunEvent } from "../hooks/useQuestionRunEvents";

interface Props {
  runId: string;
  className?: string;
}

const ICONS: Record<string, { icon: typeof PlayCircle; tone: string }> = {
  started: { icon: PlayCircle, tone: "text-primary" },
  batch_started: { icon: Loader2, tone: "text-muted-foreground" },
  batch_completed: { icon: CheckCircle2, tone: "text-emerald-600 dark:text-emerald-400" },
  batch_failed: { icon: XCircle, tone: "text-destructive" },
  cross_doc_started: { icon: Network, tone: "text-primary" },
  cross_doc_completed: { icon: CheckCircle2, tone: "text-emerald-600 dark:text-emerald-400" },
  cross_doc_failed: { icon: XCircle, tone: "text-destructive" },
  completed: { icon: CheckCircle2, tone: "text-emerald-600 dark:text-emerald-400" },
  partial: { icon: AlertTriangle, tone: "text-amber-600 dark:text-amber-400" },
  failed: { icon: XCircle, tone: "text-destructive" },
  reaped: { icon: AlertTriangle, tone: "text-amber-600 dark:text-amber-400" },
};

function eventIcon(type: string) {
  return ICONS[type] ?? { icon: Layers, tone: "text-muted-foreground" };
}

export function RunTimeline({ runId, className }: Props) {
  const { data: events = [], isLoading } = useQuestionRunEvents(runId);

  if (isLoading) {
    return (
      <div className={cn("text-xs text-muted-foreground italic px-1 py-2", className)}>
        Loading timeline…
      </div>
    );
  }

  if (events.length === 0) {
    return (
      <div className={cn("text-xs text-muted-foreground italic px-1 py-2", className)}>
        No timeline events were recorded for this run. Older runs (before timeline tracking
        was enabled) won't have details here.
      </div>
    );
  }

  return (
    <ScrollArea className={cn("h-56 rounded-md border bg-muted/30 px-3 py-2", className)}>
      <ol className="space-y-2">
        {events.map((e: QuestionRunEvent) => {
          const { icon: Icon, tone } = eventIcon(e.event_type);
          const spin = e.event_type === "batch_started";
          return (
            <li key={e.id} className="flex items-start gap-2 text-xs">
              <Icon className={cn("h-3.5 w-3.5 mt-0.5 shrink-0", tone, spin && "animate-spin")} />
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="font-medium uppercase tracking-wide text-[10px] text-muted-foreground">
                    {e.event_type.replace(/_/g, " ")}
                  </span>
                  <span className="text-[10px] text-muted-foreground tabular-nums">
                    {format(new Date(e.created_at), "HH:mm:ss")}
                  </span>
                </div>
                {e.message && (
                  <p className="text-foreground/90 break-words">{e.message}</p>
                )}
              </div>
            </li>
          );
        })}
      </ol>
    </ScrollArea>
  );
}
