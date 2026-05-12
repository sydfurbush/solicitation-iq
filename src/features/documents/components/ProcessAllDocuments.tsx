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
  const [running, setRunning] = useState(false);
  const [done, setDone] = useState(0);

  const targets = documents.filter((d) => d.status === "parsed" || d.status === "failed" || d.status === "uploading");
  const total = targets.length;

  if (total === 0) return null;

  const start = async () => {
    setRunning(true);
    setDone(0);
    const { processed, failed } = await runWithConcurrency(
      targets,
      async (d) => invokeProcessDocument(d.id),
      CONCURRENCY,
      () => setDone((n) => n + 1)
    );
    setRunning(false);
    qc.invalidateQueries({ queryKey: ["documents", solicitationId] });
    toast({
      title: "Processing complete",
      description: `${processed - failed} processed${failed ? `, ${failed} failed` : ""}.`,
    });
  };

  return (
    <div className="flex flex-col sm:flex-row sm:items-center gap-3">
      <Button onClick={start} disabled={running} variant="outline">
        {running ? (
          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
        ) : (
          <PlayCircle className="mr-2 h-4 w-4" />
        )}
        {running ? `Processing ${done} of ${total}…` : `Process all (${total})`}
      </Button>
      {running && <Progress value={(done / total) * 100} className="h-1.5 flex-1 max-w-xs" />}
    </div>
  );
}
