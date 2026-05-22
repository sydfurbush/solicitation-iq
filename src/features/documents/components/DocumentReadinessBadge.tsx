import { AlertTriangle, CheckCircle2, Loader2, RefreshCw } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { toast } from "@/hooks/use-toast";
import { useExtractEntities } from "../hooks/useProcessDocument";
import type { DocumentsReadiness } from "../hooks/useDocumentsReadiness";

interface Props {
  readiness: DocumentsReadiness;
  className?: string;
}

export function DocumentReadinessBadge({ readiness, className }: Props) {
  const { total, analyzed, failed, processing, stalled, stalledDocs, allReady, hasFailures, hasStalled } =
    readiness;
  const extract = useExtractEntities();

  if (total === 0) return null;

  if (allReady && !hasFailures) {
    return (
      <p
        className={cn(
          "inline-flex items-center gap-1.5 text-xs font-medium text-emerald-600 dark:text-emerald-400",
          className,
        )}
      >
        <CheckCircle2 className="h-3.5 w-3.5" />
        All {total} document{total === 1 ? "" : "s"} analyzed
      </p>
    );
  }

  if (hasStalled) {
    const handleRetry = () => {
      stalledDocs.forEach((d) => extract.mutate(d.id));
      toast({
        title: `Retrying analysis on ${stalled} document${stalled === 1 ? "" : "s"}`,
      });
    };
    return (
      <div
        className={cn(
          "inline-flex items-center gap-2 text-xs font-medium text-amber-600 dark:text-amber-400",
          className,
        )}
      >
        <AlertTriangle className="h-3.5 w-3.5" />
        <span>
          {analyzed} of {total} analyzed · {stalled} stalled
          {processing > 0 ? ` · ${processing} processing` : ""}
          {failed > 0 ? ` · ${failed} failed` : ""}
        </span>
        <Button
          size="sm"
          variant="outline"
          className="h-6 px-2 text-xs"
          onClick={handleRetry}
          disabled={extract.isPending}
        >
          <RefreshCw
            className={cn("mr-1 h-3 w-3", extract.isPending && "animate-spin")}
          />
          Retry
        </Button>
      </div>
    );
  }

  if (hasFailures) {
    return (
      <p
        className={cn(
          "inline-flex items-center gap-1.5 text-xs font-medium text-destructive",
          className,
        )}
      >
        <AlertTriangle className="h-3.5 w-3.5" />
        {analyzed} of {total} analyzed · {failed} failed
        {processing > 0 ? ` · ${processing} processing` : ""}
      </p>
    );
  }

  return (
    <p
      className={cn(
        "inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground",
        className,
      )}
    >
      <Loader2 className="h-3.5 w-3.5 animate-spin text-primary" />
      {analyzed} of {total} analyzed · {processing} processing…
    </p>
  );
}
