import { useMemo, useState } from "react";
import { formatDistanceToNow } from "date-fns";
import { Copy, Download, Loader2, RotateCcw } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { ScrollArea } from "@/components/ui/scroll-area";
import { toast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { useGenerateQuestions } from "../hooks/useStrategicQuestions";
import {
  useQuestionGenerationRuns,
  type QuestionRun,
} from "../hooks/useQuestionGenerationRuns";
import { downloadRunReport } from "../utils/runReport";

interface Props {
  solicitationId: string;
  documents: Array<{ id: string; file_name: string }>;
  open: boolean;
  onOpenChange: (o: boolean) => void;
}

const STATUS_STYLES: Record<QuestionRun["status"], string> = {
  running: "bg-primary/10 text-primary border-primary/30",
  completed: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/30",
  partial: "bg-amber-500/10 text-amber-700 dark:text-amber-500 border-amber-500/30",
  failed: "bg-destructive/10 text-destructive border-destructive/30",
};

function formatDuration(startedAt: string, completedAt: string | null): string {
  if (!completedAt) return "running…";
  const ms = new Date(completedAt).getTime() - new Date(startedAt).getTime();
  if (ms < 1000) return "<1s";
  const s = Math.round(ms / 1000);
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  const rs = s % 60;
  return `${m}m ${rs}s`;
}

export function QuestionRunsHistorySheet({ solicitationId, documents, open, onOpenChange }: Props) {
  const { data: runs = [], isLoading } = useQuestionGenerationRuns(open ? solicitationId : undefined);
  const generate = useGenerateQuestions(solicitationId);
  const [retryingId, setRetryingId] = useState<string | null>(null);
  const [progress, setProgress] = useState<{ completed: number; total: number; inserted: number; step: string | null } | null>(null);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);

  const docMap = useMemo(() => new Map(documents.map((d) => [d.id, d.file_name])), [documents]);
  const runById = useMemo(() => new Map(runs.map((r) => [r.id, r])), [runs]);

  const handleRetry = async (run: QuestionRun) => {
    setRetryingId(run.id);
    setProgress({ completed: 0, total: 0, inserted: 0, step: "Starting…" });
    try {
      const result = await generate.mutateAsync({
        retryRunId: run.id,
        onProgress: setProgress,
      });
      if (result.status === "completed") {
        toast({ title: "Retry complete", description: `${result.count} questions added.` });
      } else if (result.status === "partial") {
        toast({
          title: "Partially retried",
          description: `${result.count} added · ${result.failedBatches} batch(es) still failed.`,
        });
      } else {
        toast({ title: "Retry failed", description: result.error ?? "All batches failed.", variant: "destructive" });
      }
    } catch (e) {
      toast({ title: "Retry failed", description: e instanceof Error ? e.message : String(e), variant: "destructive" });
    } finally {
      setRetryingId(null);
      setProgress(null);
    }
  };

  const handleCopyError = async (msg: string) => {
    try {
      await navigator.clipboard.writeText(msg);
      toast({ title: "Error copied" });
    } catch {
      toast({ title: "Could not copy", variant: "destructive" });
    }
  };

  const handleDownload = async (run: QuestionRun) => {
    setDownloadingId(run.id);
    try {
      const count = await downloadRunReport({
        runId: run.id,
        solicitationId: solicitationId,
        status: run.status,
        startedAt: run.started_at,
        completedAt: run.completed_at,
        totalBatches: run.total_batches,
        completedBatches: run.completed_batches,
        failedBatches: run.failed_batches,
        insertedCount: run.inserted_count,
        currentStep: run.current_step,
        errorMessage: run.error_message,
        failedDocNames: run.failed_doc_ids.map((id) => docMap.get(id) ?? "Unknown document"),
        crossDocFailed: run.cross_doc_failed,
        parentRunId: run.parent_run_id,
      });
      toast({ title: "Report downloaded", description: `${count} question${count === 1 ? "" : "s"} included.` });
    } catch (e) {
      toast({ title: "Download failed", description: e instanceof Error ? e.message : String(e), variant: "destructive" });
    } finally {
      setDownloadingId(null);
    }
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-2xl overflow-hidden flex flex-col">
        <SheetHeader>
          <SheetTitle>Question generation runs</SheetTitle>
          <SheetDescription>
            Audit trail of every AI generation attempt for this solicitation.
          </SheetDescription>
        </SheetHeader>

        {generate.isPending && progress && (
          <Alert className="mt-4">
            <AlertDescription className="text-sm">
              <div className="font-medium">
                {progress.total > 0
                  ? `Batch ${progress.completed} of ${progress.total} complete`
                  : "Starting…"}
                {progress.inserted > 0 ? ` · ${progress.inserted} questions added` : ""}
              </div>
              {progress.step && <div className="text-muted-foreground">{progress.step}</div>}
            </AlertDescription>
          </Alert>
        )}

        <ScrollArea className="flex-1 -mx-6 px-6 mt-4">
          {isLoading ? (
            <div className="space-y-3">
              {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-32 w-full" />)}
            </div>
          ) : runs.length === 0 ? (
            <div className="text-center py-16 text-sm text-muted-foreground">
              No generation runs yet. Click <span className="font-medium">Generate</span> to create the first one.
            </div>
          ) : (
            <div className="space-y-3 pb-4">
              {runs.map((run) => {
                const failedNames = run.failed_doc_ids
                  .map((id) => docMap.get(id) ?? "Unknown document");
                const hasFailure =
                  run.failed_doc_ids.length > 0 || run.cross_doc_failed || run.failed_batches > 0;
                const canRetry = (run.status === "partial" || run.status === "failed") && hasFailure;
                const unknownScope =
                  canRetry && run.failed_doc_ids.length === 0 && !run.cross_doc_failed;
                const parent = run.parent_run_id ? runById.get(run.parent_run_id) : null;
                return (
                  <div
                    key={run.id}
                    className="rounded-lg border bg-card p-4 space-y-3"
                  >
                    <div className="flex items-start justify-between gap-3 flex-wrap">
                      <div className="space-y-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <Badge variant="outline" className={cn("capitalize", STATUS_STYLES[run.status])}>
                            {run.status === "running" && (
                              <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                            )}
                            {run.status}
                          </Badge>
                          <span
                            className="text-sm text-muted-foreground"
                            title={new Date(run.started_at).toLocaleString()}
                          >
                            {formatDistanceToNow(new Date(run.started_at), { addSuffix: true })}
                          </span>
                          <span className="text-xs text-muted-foreground">
                            · {formatDuration(run.started_at, run.completed_at)}
                          </span>
                        </div>
                        {parent && (
                          <p className="text-xs text-muted-foreground">
                            ↳ retry of run from{" "}
                            {formatDistanceToNow(new Date(parent.started_at), { addSuffix: true })}
                          </p>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        {run.status !== "running" && (
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => handleDownload(run)}
                            disabled={downloadingId === run.id}
                          >
                            {downloadingId === run.id ? (
                              <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                            ) : (
                              <Download className="h-3 w-3 mr-1" />
                            )}
                            Report
                          </Button>
                        )}
                        {run.error_message && (
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => handleCopyError(run.error_message!)}
                          >
                            <Copy className="h-3 w-3 mr-1" /> Copy error
                          </Button>
                        )}
                        {canRetry && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleRetry(run)}
                            disabled={generate.isPending}
                          >
                            {retryingId === run.id ? (
                              <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                            ) : (
                              <RotateCcw className="h-3 w-3 mr-1" />
                            )}
                            {unknownScope ? "Retry run" : "Retry failed"}
                          </Button>
                        )}
                      </div>
                    </div>

                    <div className="grid grid-cols-3 gap-3 text-sm">
                      <div>
                        <p className="text-xs text-muted-foreground uppercase tracking-wide">Batches</p>
                        <p className="font-medium">
                          {run.completed_batches}/{run.total_batches}
                          {run.failed_batches > 0 && (
                            <span className="text-destructive ml-1">· {run.failed_batches} failed</span>
                          )}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground uppercase tracking-wide">Inserted</p>
                        <p className="font-medium">{run.inserted_count}</p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground uppercase tracking-wide">Step</p>
                        <p className="font-medium truncate" title={run.current_step ?? ""}>
                          {run.current_step ?? "—"}
                        </p>
                      </div>
                    </div>

                    {(failedNames.length > 0 || run.cross_doc_failed) && (
                      <div>
                        <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">Failed</p>
                        <div className="flex flex-wrap gap-1">
                          {failedNames.map((n, i) => (
                            <Badge key={`${n}-${i}`} variant="secondary" className="font-normal">
                              {n}
                            </Badge>
                          ))}
                          {run.cross_doc_failed && (
                            <Badge variant="secondary" className="font-normal">
                              cross-document pass
                            </Badge>
                          )}
                        </div>
                      </div>
                    )}

                    {run.error_message && (
                      <p className="text-xs italic text-muted-foreground border-l-2 border-destructive/50 pl-2">
                        {run.error_message}
                      </p>
                    )}
                  </div>
                );
              })}
              {runs.length === 50 && (
                <p className="text-xs text-center text-muted-foreground pt-2">
                  Showing latest 50 runs.
                </p>
              )}
            </div>
          )}
        </ScrollArea>
      </SheetContent>
    </Sheet>
  );
}
