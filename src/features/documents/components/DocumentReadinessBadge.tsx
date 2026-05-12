import { AlertTriangle, CheckCircle2, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import type { DocumentsReadiness } from "../hooks/useDocumentsReadiness";

interface Props {
  readiness: DocumentsReadiness;
  className?: string;
}

export function DocumentReadinessBadge({ readiness, className }: Props) {
  const { total, analyzed, failed, processing, allReady, hasFailures } = readiness;

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
