import { useRef, useState } from "react";
import { ArrowDownRight, ArrowUpRight, AlertTriangle, DownloadCloud, Minus, RefreshCw, Unlink, X } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { cn } from "@/lib/utils";
import { useSolicitation } from "@/features/solicitations/hooks/useSolicitations";
import { usePriorSolicitation, useUnlinkPriorSolicitation, type PriorSolicitationRow, type ComparisonChanges } from "../hooks/usePriorSolicitation";
import { useRunComparison } from "../hooks/useRunComparison";
import { useImportPriorFromSam, waitForDocumentsParsed, ImportCancelledError, type ImportProgress } from "../hooks/useImportPriorFromSam";
import { ImportProgressPanel } from "./ImportProgressPanel";
import { fmtCurrency, fmtDate, pctDelta } from "../utils/diffHelpers";
import { toast } from "@/hooks/use-toast";

type Props = { solicitationId: string; priorRecord: PriorSolicitationRow; changes: ComparisonChanges | null };

export function ComparisonOverview({ solicitationId, priorRecord, changes }: Props) {
  const { data: current } = useSolicitation(solicitationId);
  const { data: prior } = useSolicitation(priorRecord.prior_solicitation_id ?? undefined);
  const { refetch: refetchLink } = usePriorSolicitation(solicitationId);
  const unlink = useUnlinkPriorSolicitation(solicitationId);
  const compare = useRunComparison(solicitationId);
  const importFromSam = useImportPriorFromSam(solicitationId);
  const [progress, setProgress] = useState<ImportProgress | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const isExternalOnly = !priorRecord.prior_solicitation_id && !!priorRecord.external_reference;

  const handleCancelImport = () => {
    abortRef.current?.abort();
    setProgress({ stage: "error", message: "Cancelled by user." });
    toast({ title: "Import cancelled" });
  };

  const valueDelta = pctDelta(prior?.estimated_value_high ?? null, current?.estimated_value_high ?? null);
  const reqDelta = (current?.key_requirements as unknown[] | null)?.length ?? 0
    - ((prior?.key_requirements as unknown[] | null)?.length ?? 0);
  const evalDelta = (current?.evaluation_factors as unknown[] | null)?.length ?? 0
    - ((prior?.evaluation_factors as unknown[] | null)?.length ?? 0);

  const handleRerun = () => {
    compare.mutate(
      { priorSolicitationId: priorRecord.prior_solicitation_id, priorRecordId: priorRecord.id },
      {
        onSuccess: () => toast({ title: "Comparison updated" }),
        onError: (e) => toast({ title: "Comparison failed", description: e instanceof Error ? e.message : String(e), variant: "destructive" }),
      }
    );
  };

  const handleUnlink = async () => {
    try {
      await unlink.mutateAsync(priorRecord.id);
      toast({ title: "Unlinked" });
      refetchLink();
    } catch (e) {
      toast({ title: "Failed", description: e instanceof Error ? e.message : String(e), variant: "destructive" });
    }
  };

  const handleImportFromSam = async () => {
    const controller = new AbortController();
    abortRef.current = controller;
    try {
      const result = await importFromSam.mutateAsync({
        url: priorRecord.external_url,
        solicitationNumber: priorRecord.external_reference,
        externalReference: priorRecord.external_reference,
        onProgress: setProgress,
      });
      if (controller.signal.aborted) throw new ImportCancelledError();
      // Drop the legacy external-only link so the new fully-linked record is canonical
      try { await unlink.mutateAsync(priorRecord.id); } catch { /* ignore */ }

      if (result.imported > 0) {
        setProgress({
          stage: "parsing",
          message: `Parsing ${result.imported} document(s)…`,
          found: result.found,
          imported: result.imported,
          failed: result.failed,
          parsed: 0,
          totalDocs: result.imported,
        });
        await waitForDocumentsParsed(result.priorSolicitationId, {
          signal: controller.signal,
          onProgress: ({ parsed, total }) =>
            setProgress((p) => p && {
              ...p,
              stage: "parsing",
              message: `Parsing documents (${parsed}/${total})…`,
              parsed,
              totalDocs: total,
            }),
        });
      }

      if (controller.signal.aborted) throw new ImportCancelledError();
      setProgress((p) => p && { ...p, stage: "comparing", message: "Running AI comparison…" });
      await new Promise<void>((resolve, reject) =>
        compare.mutate(
          { priorSolicitationId: result.priorSolicitationId, priorRecordId: result.priorRecordId },
          {
            onSuccess: () => { refetchLink(); resolve(); },
            onError: (e) => reject(e),
          },
        ),
      );

      setProgress((p) => p && {
        ...p,
        stage: "done",
        message: `Done — ${result.imported}/${result.found} attachment(s) imported, comparison updated.`,
      });
      toast({ title: "Comparison updated" });
    } catch (e) {
      if (e instanceof ImportCancelledError || controller.signal.aborted) {
        setProgress({ stage: "error", message: "Cancelled by user." });
      } else {
        setProgress({ stage: "error", message: e instanceof Error ? e.message : String(e) });
        toast({ title: "SAM import failed", description: e instanceof Error ? e.message : String(e), variant: "destructive" });
      }
    } finally {
      if (abortRef.current === controller) abortRef.current = null;
    }
  };
  const importing =
    importFromSam.isPending ||
    compare.isPending ||
    (!!progress && progress.stage !== "done" && progress.stage !== "error");

  const totalChanges =
    (changes?.requirements?.length ?? 0) +
    (changes?.evaluation_factors?.length ?? 0) +
    (changes?.scope?.length ?? 0) +
    (changes?.timeline?.length ?? 0) +
    (changes?.financial?.length ?? 0);

  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between gap-4">
        <div>
          <CardTitle>Comparison overview</CardTitle>
          <p className="text-sm text-muted-foreground mt-1">
            {totalChanges > 0 ? `${totalChanges} significant changes identified` : "No comparison data yet"}
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={handleUnlink}>
            <Unlink className="mr-2 h-4 w-4" /> Unlink
          </Button>
          <Button size="sm" onClick={handleRerun} disabled={compare.isPending}>
            <RefreshCw className={cn("mr-2 h-4 w-4", compare.isPending && "animate-spin")} />
            {priorRecord.comparison_completed_at ? "Re-run" : "Run"} comparison
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {isExternalOnly && (
          <Alert variant="default" className="border-amber-500/40 bg-amber-500/5">
            <AlertTriangle className="h-4 w-4 text-amber-600" />
            <AlertTitle>Comparison is limited</AlertTitle>
            <AlertDescription className="space-y-2">
              <p>
                The prior solicitation is only referenced ({priorRecord.external_reference}) — its documents
                were never imported, so the AI has nothing concrete to diff against. Import attachments from
                SAM.gov to get a full requirement-level comparison.
              </p>
              <div className="space-y-2">
                <Button size="sm" onClick={handleImportFromSam} disabled={importing}>
                  <DownloadCloud className={cn("mr-2 h-4 w-4", importing && "animate-pulse")} />
                  {importing ? (progress?.message ?? "Importing…") : "Import from SAM.gov"}
                </Button>
                {progress && <ImportProgressPanel progress={progress} />}
              </div>
            </AlertDescription>
          </Alert>
        )}
        <div className="grid md:grid-cols-2 gap-4">
          <SolicitationHeader label="Prior" sol={prior ?? null} fallback={priorRecord.external_reference} fallbackUrl={priorRecord.external_url} />
          <SolicitationHeader label="Current" sol={current ?? null} />
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <Metric label="Contract value" delta={valueDelta} priorVal={fmtCurrency(prior?.estimated_value_high)} currentVal={fmtCurrency(current?.estimated_value_high)} />
          <Metric label="Requirements" delta={reqDelta} priorVal={String((prior?.key_requirements as unknown[] | null)?.length ?? 0)} currentVal={String((current?.key_requirements as unknown[] | null)?.length ?? 0)} integer />
          <Metric label="Eval factors" delta={evalDelta} priorVal={String((prior?.evaluation_factors as unknown[] | null)?.length ?? 0)} currentVal={String((current?.evaluation_factors as unknown[] | null)?.length ?? 0)} integer />
          <Metric label="Proposal due" priorVal={fmtDate(prior?.proposal_due_date)} currentVal={fmtDate(current?.proposal_due_date)} />
        </div>

        {priorRecord.comparison_summary && (
          <div className="rounded-md border bg-muted/30 p-3 text-sm">
            <p className="text-xs uppercase tracking-wide text-muted-foreground mb-1">Summary</p>
            {priorRecord.comparison_summary}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function SolicitationHeader({ label, sol, fallback, fallbackUrl }: { label: string; sol: { title?: string | null; solicitation_number?: string | null; issuing_agency?: string | null } | null; fallback?: string | null; fallbackUrl?: string | null }) {
  return (
    <div className="rounded-md border p-3">
      <Badge variant="outline" className="mb-2">{label}</Badge>
      {sol ? (
        <>
          <p className="font-medium leading-tight">{sol.title}</p>
          <p className="text-xs text-muted-foreground mt-1">{sol.solicitation_number ?? "—"} • {sol.issuing_agency ?? "—"}</p>
        </>
      ) : fallback ? (
        <>
          <p className="font-medium">External reference</p>
          <p className="text-xs text-muted-foreground mt-1">{fallback}</p>
          {fallbackUrl && <a href={fallbackUrl} target="_blank" rel="noreferrer" className="text-xs text-primary underline mt-1 inline-block">Open</a>}
        </>
      ) : (
        <p className="text-sm text-muted-foreground">Not available</p>
      )}
    </div>
  );
}

function Metric({ label, priorVal, currentVal, delta, integer }: { label: string; priorVal: string; currentVal: string; delta?: number | null; integer?: boolean }) {
  const Arrow = delta == null || delta === 0 ? Minus : delta > 0 ? ArrowUpRight : ArrowDownRight;
  const color = delta == null || delta === 0 ? "text-muted-foreground" : delta > 0 ? "text-emerald-600" : "text-destructive";
  return (
    <div className="rounded-md border p-3">
      <p className="text-xs uppercase tracking-wide text-muted-foreground">{label}</p>
      <div className="mt-2 flex items-baseline justify-between gap-2">
        <div className="text-xs text-muted-foreground line-through">{priorVal}</div>
        <div className="font-semibold">{currentVal}</div>
      </div>
      {delta != null && (
        <div className={cn("flex items-center gap-1 text-xs mt-1", color)}>
          <Arrow className="h-3 w-3" />
          {integer ? `${delta > 0 ? "+" : ""}${delta}` : `${delta > 0 ? "+" : ""}${delta.toFixed(1)}%`}
        </div>
      )}
    </div>
  );
}
