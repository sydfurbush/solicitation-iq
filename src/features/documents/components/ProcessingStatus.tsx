import { CheckCircle2, Loader2, AlertCircle, RefreshCw, FileSearch, FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";
import { useProcessingStatus, useReprocessDocument } from "../hooks/useProcessDocument";
import type { DocumentStatus } from "../hooks/useDocuments";

const STEPS: Array<{ key: DocumentStatus; label: string; icon: typeof FileText }> = [
  { key: "uploading", label: "Uploading", icon: FileText },
  { key: "processing", label: "Extracting text", icon: FileSearch },
  { key: "parsed", label: "Parsing sections", icon: FileSearch },
  { key: "analyzed", label: "Analyzed", icon: CheckCircle2 },
];

const ORDER: Record<DocumentStatus, number> = {
  uploading: 0,
  processing: 1,
  parsed: 2,
  analyzed: 3,
  failed: -1,
};

export function ProcessingStatus({ documentId }: { documentId: string }) {
  const { data } = useProcessingStatus(documentId);
  const reprocess = useReprocessDocument();
  const status = (data?.status ?? "processing") as DocumentStatus;

  if (status === "failed") {
    return (
      <div className="rounded-md border border-destructive/30 bg-destructive/5 p-4">
        <div className="flex items-start gap-3">
          <AlertCircle className="h-5 w-5 text-destructive shrink-0 mt-0.5" />
          <div className="flex-1 min-w-0">
            <p className="font-medium text-sm">Processing failed</p>
            {data?.processing_error && (
              <p className="text-xs text-muted-foreground mt-1 break-words">
                {data.processing_error}
              </p>
            )}
          </div>
          <Button
            size="sm"
            variant="outline"
            onClick={() => reprocess.mutate(documentId)}
            disabled={reprocess.isPending}
          >
            <RefreshCw className={cn("mr-2 h-4 w-4", reprocess.isPending && "animate-spin")} />
            Retry
          </Button>
        </div>
      </div>
    );
  }

  const currentIndex = ORDER[status] ?? 0;
  const pct = ((currentIndex + 1) / STEPS.length) * 100;

  return (
    <div className="rounded-md border bg-card p-4 space-y-3">
      <div className="flex items-center justify-between text-sm">
        <span className="font-medium">{STEPS[currentIndex]?.label ?? "Processing…"}</span>
        <span className="text-muted-foreground text-xs">
          {currentIndex + 1} / {STEPS.length}
        </span>
      </div>
      <Progress value={pct} className="h-1.5" />
      <ul className="grid grid-cols-4 gap-2">
        {STEPS.map((s, i) => {
          const done = i < currentIndex || status === "analyzed";
          const active = i === currentIndex && status !== "analyzed";
          const Icon = done ? CheckCircle2 : active ? Loader2 : s.icon;
          return (
            <li
              key={s.key}
              className={cn(
                "flex flex-col items-center text-center gap-1 text-[11px]",
                done ? "text-emerald-600" : active ? "text-primary" : "text-muted-foreground"
              )}
            >
              <Icon className={cn("h-4 w-4", active && "animate-spin")} />
              <span className="leading-tight">{s.label}</span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
