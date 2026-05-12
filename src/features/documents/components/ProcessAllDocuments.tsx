import { useState } from "react";
import { Loader2, PlayCircle, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { useQueryClient } from "@tanstack/react-query";
import { invokeProcessDocument } from "@/lib/supabase/functions";
import { toast } from "@/hooks/use-toast";
import type { DocumentRow } from "../hooks/useDocuments";

const CONCURRENCY = 3;

async function runWithConcurrency<T>(
  items: T[],
  worker: (item: T) => Promise<unknown>,
  limit: number,
  onTick: () => void
) {
  let i = 0;
  let failed = 0;
  const queue = [...items];

  async function next() {
    while (queue.length) {
      const item = queue.shift()!;
      try {
        await worker(item);
      } catch {
        failed++;
      }
      i++;
      onTick();
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, () => next()));
  return { processed: i, failed };
}

export function ProcessAllDocuments({
  documents,
  solicitationId,
}: {
  documents: DocumentRow[];
  solicitationId: string;
}) {
  const qc = useQueryClient();
  const [running, setRunning] = useState<"all" | "failed" | null>(null);
  const [done, setDone] = useState(0);

  const targets = documents.filter((d) => d.status === "parsed" || d.status === "failed" || d.status === "uploading");
  const failedTargets = documents.filter((d) => d.status === "failed");
  const total = targets.length;

  if (total === 0) return null;

  const run = async (mode: "all" | "failed") => {
    const items = mode === "failed" ? failedTargets : targets;
    if (items.length === 0) return;
    setRunning(mode);
    setDone(0);
    const { processed, failed } = await runWithConcurrency(
      items,
      async (d) => invokeProcessDocument(d.id),
      CONCURRENCY,
      () => setDone((n) => n + 1)
    );
    setRunning(null);
    qc.invalidateQueries({ queryKey: ["documents", solicitationId] });
    toast({
      title: mode === "failed" ? "Retry complete" : "Processing complete",
      description: `${processed - failed} processed${failed ? `, ${failed} failed` : ""}.`,
    });
  };

  const isRunning = running !== null;
  const activeTotal = running === "failed" ? failedTargets.length : total;

  return (
    <div className="flex flex-col sm:flex-row sm:items-center gap-3">
      <Button onClick={() => run("all")} disabled={isRunning} variant="outline">
        {running === "all" ? (
          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
        ) : (
          <PlayCircle className="mr-2 h-4 w-4" />
        )}
        {running === "all" ? `Processing ${done} of ${activeTotal}…` : `Process all (${total})`}
      </Button>
      {failedTargets.length > 0 && (
        <Button
          onClick={() => run("failed")}
          disabled={isRunning}
          variant="outline"
          className="text-destructive border-destructive/40 hover:bg-destructive/10"
        >
          {running === "failed" ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <RefreshCw className="mr-2 h-4 w-4" />
          )}
          {running === "failed"
            ? `Retrying ${done} of ${activeTotal}…`
            : `Retry failed (${failedTargets.length})`}
        </Button>
      )}
      {isRunning && <Progress value={(done / activeTotal) * 100} className="h-1.5 flex-1 max-w-xs" />}
    </div>
  );
}
