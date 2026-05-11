import { useMemo, useState } from "react";
import { Loader2, RotateCcw, Sparkles } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { toast } from "@/hooks/use-toast";
import { useGenerateQuestions, useLatestQuestionRun } from "../hooks/useStrategicQuestions";

const FOCUS_OPTIONS = ["Technical", "Management", "Pricing", "Compliance", "Staffing"];

interface Props {
  solicitationId: string;
  documents: Array<{ id: string; file_name: string }>;
  hasExistingAi: boolean;
  open: boolean;
  onOpenChange: (o: boolean) => void;
}

export function GenerateQuestionsDialog({ solicitationId, documents, hasExistingAi, open, onOpenChange }: Props) {
  const [focusAreas, setFocusAreas] = useState<string[]>([]);
  const [docIds, setDocIds] = useState<string[]>([]);
  const [regenerate, setRegenerate] = useState(false);
  const [progress, setProgress] = useState<{ completed: number; total: number; inserted: number; step: string | null } | null>(null);
  const generate = useGenerateQuestions(solicitationId);
  const { data: latestRun } = useLatestQuestionRun(open ? solicitationId : undefined);

  const retryable = useMemo(() => {
    if (!latestRun) return null;
    const failedIds = (latestRun.failed_doc_ids ?? []) as string[];
    const crossDoc = !!latestRun.cross_doc_failed;
    const status = latestRun.status as string;
    if ((status === "partial" || status === "failed") && (failedIds.length > 0 || crossDoc)) {
      const docMap = new Map(documents.map((d) => [d.id, d.file_name]));
      const failedNames = failedIds.map((id) => docMap.get(id)).filter(Boolean) as string[];
      return { runId: latestRun.id as string, failedNames, crossDoc, count: failedIds.length + (crossDoc ? 1 : 0) };
    }
    return null;
  }, [latestRun, documents]);

  const toggle = (arr: string[], v: string) => arr.includes(v) ? arr.filter((x) => x !== v) : [...arr, v];

  const runGenerate = async (overrides?: { retryRunId?: string }) => {
    setProgress({ completed: 0, total: 0, inserted: 0, step: "Starting…" });
    try {
      const result = await generate.mutateAsync({
        focusAreas: overrides?.retryRunId ? undefined : (focusAreas.length ? focusAreas : undefined),
        focusDocumentIds: overrides?.retryRunId ? undefined : (docIds.length ? docIds : undefined),
        regenerate: overrides?.retryRunId ? false : regenerate,
        retryRunId: overrides?.retryRunId,
        onProgress: setProgress,
      });
      const verb = overrides?.retryRunId ? "Retried" : "Generated";
      if (result.status === "completed") {
        toast({ title: `${verb} successfully`, description: `${result.count} questions added.` });
      } else if (result.status === "partial") {
        toast({
          title: "Partially generated",
          description: `${result.count} questions added · ${result.failedBatches} batch(es) failed. You can retry the failed batches.`,
        });
      } else {
        toast({ title: "Generation failed", description: result.error ?? "All batches failed.", variant: "destructive" });
      }
      onOpenChange(false);
    } catch (e) {
      toast({ title: "Generation failed", description: e instanceof Error ? e.message : String(e), variant: "destructive" });
    } finally {
      setProgress(null);
    }
  };

  const handleRun = () => runGenerate();
  const handleRetry = () => retryable && runGenerate({ retryRunId: retryable.runId });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-primary" /> Generate strategic questions
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {retryable && (
            <Alert>
              <AlertDescription className="text-sm space-y-2">
                <div className="font-medium">
                  Last run finished with {retryable.count} failed batch{retryable.count === 1 ? "" : "es"}.
                </div>
                {retryable.failedNames.length > 0 && (
                  <div className="text-muted-foreground">
                    Failed: {retryable.failedNames.join(", ")}
                    {retryable.crossDoc ? " · cross-document pass" : ""}
                  </div>
                )}
                {retryable.failedNames.length === 0 && retryable.crossDoc && (
                  <div className="text-muted-foreground">Failed: cross-document pass</div>
                )}
                <Button size="sm" variant="outline" onClick={handleRetry} disabled={generate.isPending}>
                  <RotateCcw className="h-4 w-4 mr-2" /> Retry failed batches
                </Button>
              </AlertDescription>
            </Alert>
          )}

          {hasExistingAi && (
            <Alert>
              <AlertDescription className="text-sm">
                AI-generated questions already exist. Enable "Replace existing" to regenerate them.
              </AlertDescription>
            </Alert>
          )}

          <div className="space-y-2">
            <Label>Focus areas (optional)</Label>
            <div className="flex flex-wrap gap-2">
              {FOCUS_OPTIONS.map((f) => (
                <label key={f} className="flex items-center gap-2 rounded-md border px-3 py-1.5 text-sm cursor-pointer whitespace-nowrap">
                  <Checkbox checked={focusAreas.includes(f)} onCheckedChange={() => setFocusAreas((s) => toggle(s, f))} />
                  {f}
                </label>
              ))}
            </div>
          </div>

          <div className="space-y-2">
            <Label>Limit to documents (optional)</Label>
            <ScrollArea className="h-32 rounded-md border p-2">
              {documents.length === 0 ? (
                <p className="text-sm text-muted-foreground p-2">No processed documents available.</p>
              ) : (
                <div className="pr-2">
                  {documents.map((d) => (
                    <label key={d.id} className="flex items-center gap-2 py-1 text-sm w-full min-w-0">
                      <Checkbox checked={docIds.includes(d.id)} onCheckedChange={() => setDocIds((s) => toggle(s, d.id))} />
                      <span className="flex-1 min-w-0 truncate" title={d.file_name}>{d.file_name}</span>
                    </label>
                  ))}
                </div>
              )}
            </ScrollArea>
          </div>

          <label className="flex items-center gap-2 text-sm">
            <Checkbox checked={regenerate} onCheckedChange={(c) => setRegenerate(c === true)} />
            Replace existing AI-generated questions
          </label>

          {generate.isPending && progress && (
            <Alert>
              <AlertDescription className="text-sm space-y-1">
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
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={generate.isPending}>Cancel</Button>
          <Button onClick={handleRun} disabled={generate.isPending || documents.length === 0}>
            {generate.isPending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Sparkles className="h-4 w-4 mr-2" />}
            Generate
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
