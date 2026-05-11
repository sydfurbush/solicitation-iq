import { CheckCircle2, Loader2, XCircle } from "lucide-react";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";
import type { ImportProgress, ImportStage } from "../hooks/useImportPriorFromSam";

const STAGE_ORDER: ImportStage[] = ["lookup", "creating", "downloading", "parsing", "comparing", "done"];

const STAGE_LABEL: Record<ImportStage, string> = {
  idle: "Idle",
  lookup: "Looking up SAM.gov",
  creating: "Creating prior record",
  downloading: "Downloading attachments",
  parsing: "Parsing documents",
  comparing: "Running comparison",
  done: "Complete",
  error: "Failed",
};

export function ImportProgressPanel({ progress }: { progress: ImportProgress | null }) {
  if (!progress || progress.stage === "idle") return null;

  const currentIdx = STAGE_ORDER.indexOf(progress.stage);

  let pct = 0;
  if (progress.stage === "downloading" && progress.found && progress.found > 0) {
    pct = Math.round(((progress.imported ?? 0) / progress.found) * 100);
  } else if (progress.stage === "parsing" && progress.totalDocs && progress.totalDocs > 0) {
    pct = Math.round(((progress.parsed ?? 0) / progress.totalDocs) * 100);
  } else if (progress.stage === "done") {
    pct = 100;
  } else if (currentIdx >= 0) {
    pct = Math.round(((currentIdx + 0.5) / STAGE_ORDER.length) * 100);
  }

  return (
    <div className="rounded-md border bg-muted/30 p-3 space-y-3">
      <div className="flex items-center gap-2 text-sm">
        {progress.stage === "error" ? (
          <XCircle className="h-4 w-4 text-destructive" />
        ) : progress.stage === "done" ? (
          <CheckCircle2 className="h-4 w-4 text-emerald-600" />
        ) : (
          <Loader2 className="h-4 w-4 animate-spin text-primary" />
        )}
        <span className="font-medium">{progress.message}</span>
      </div>

      <Progress value={pct} className="h-1.5" />

      <ol className="grid grid-cols-5 gap-1 text-[10px] uppercase tracking-wide">
        {STAGE_ORDER.slice(0, 5).map((stage, idx) => {
          const isDone = currentIdx > idx || progress.stage === "done";
          const isActive = currentIdx === idx;
          return (
            <li
              key={stage}
              className={cn(
                "text-center",
                isActive && "text-primary font-semibold",
                isDone && "text-emerald-600",
                !isActive && !isDone && "text-muted-foreground/60",
              )}
            >
              {STAGE_LABEL[stage]}
            </li>
          );
        })}
      </ol>

      {(progress.found != null || progress.totalDocs != null) && (
        <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground pt-1 border-t">
          {progress.found != null && (
            <span>
              <strong className="text-foreground">{progress.imported ?? 0}</strong>
              {" / "}
              {progress.found} attachment(s)
              {progress.failed ? (
                <span className="text-destructive"> · {progress.failed} failed</span>
              ) : null}
            </span>
          )}
          {progress.totalDocs != null && progress.totalDocs > 0 && (
            <span>
              <strong className="text-foreground">{progress.parsed ?? 0}</strong>
              {" / "}
              {progress.totalDocs} document(s) parsed
            </span>
          )}
        </div>
      )}
    </div>
  );
}
