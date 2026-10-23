import { useEffect, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Loader2, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { useExtractRequirements, useRequirementExtractionRun } from "../hooks/useRequirementItems";
import { useCanEditRequirementLinks } from "@/features/outline/hooks/useRequirementLinks";

export function ExtractionControl({ solicitationId, hasItems, onCompleted, disabled = false }: {
  solicitationId: string; hasItems: boolean; onCompleted?: () => void | Promise<void>; disabled?: boolean;
}) {
  const canEdit = useCanEditRequirementLinks();
  const [runId, setRunId] = useState<string | null>(null);
  const { data: run, error: pollError } = useRequirementExtractionRun(solicitationId, runId);
  const extract = useExtractRequirements(solicitationId);
  const qc = useQueryClient();
  const notified = useRef(new Set<string>());
  const callback = useRef(onCompleted);
  callback.current = onCompleted;
  useEffect(() => {
    if (run?.status === "running" && !runId) setRunId(run.id);
    if (!run || run.status === "running" || notified.current.has(run.id)) return;
    notified.current.add(run.id);
    qc.invalidateQueries({ queryKey: ["requirement-items", solicitationId] });
    if (run.status === "completed") {
      toast.success(`Added ${run.inserted_count} new requirements; skipped ${run.duplicate_count} duplicates`);
      if (run.inserted_count > 0) Promise.resolve(callback.current?.()).catch(e => toast.error(e instanceof Error ? e.message : "Gap analysis failed"));
    } else toast.error(run.error_message || "Extraction failed");
  }, [run, runId, solicitationId, qc]);
  const start = async () => {
    try { const result = await extract.mutateAsync(); setRunId(result.runId); }
    catch (e) { toast.error(e instanceof Error ? e.message : "Could not start extraction"); }
  };
  return <div className="space-y-1">
    {canEdit && <Button size="sm" onClick={start} disabled={disabled || extract.isPending || run?.status === "running"}>
      {extract.isPending || run?.status === "running" ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : <Sparkles className="mr-1 h-4 w-4" />}
      {hasItems ? "Re-run extraction (keeps existing)" : "Extract requirements"}
    </Button>}
    {run?.status === "running" && <p role="status" className="text-xs text-muted-foreground">{run.current_step || `Reading ${Math.min(run.completed_batches + 1, run.total_batches)} of ${run.total_batches} batches…`}</p>}
    {run?.status === "failed" && <p role="alert" className="max-w-md text-xs text-destructive">{run.error_message || "Extraction failed"}</p>}
    {pollError && <p role="alert" className="text-xs text-destructive">Could not read extraction progress: {pollError.message}</p>}
  </div>;
}