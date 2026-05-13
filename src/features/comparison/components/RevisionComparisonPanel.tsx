import { useEffect, useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Download, FileText, GitBranch } from "lucide-react";
import { useRevisions } from "../hooks/useRevisions";
import { useDocumentMatching } from "../hooks/useDocumentMatching";
import { RevisionTimeline } from "./RevisionTimeline";
import { RevisionPicker } from "./RevisionPicker";
import { DocumentMatchPanel } from "./DocumentMatchPanel";
import { AddRevisionDialog } from "./AddRevisionDialog";
import { ComparisonModeToggle, type ComparisonMode } from "./ComparisonModeToggle";
import { exportChangeReportPdf, exportChangeReportWord } from "../utils/changeReport";
import { useComparisonResults } from "../hooks/usePriorSolicitation";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import { toast } from "@/hooks/use-toast";
import { useSolicitation } from "@/features/solicitations/hooks/useSolicitations";
import { useMarkRevisionReviewed, useRevisionReviews, useUnmarkRevisionReviewed } from "../hooks/useRevisionReviews";
import { Check, Eye } from "lucide-react";

type Props = { solicitationId: string };

function useRevisionDocCounts(solicitationId: string) {
  return useQuery({
    queryKey: ["revision-doc-counts", solicitationId],
    enabled: !!solicitationId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("documents")
        .select("revision_id")
        .eq("solicitation_id", solicitationId)
        .is("deleted_at", null);
      if (error) throw error;
      const counts: Record<string, number> = {};
      (data ?? []).forEach((d: { revision_id: string | null }) => {
        if (d.revision_id) counts[d.revision_id] = (counts[d.revision_id] ?? 0) + 1;
      });
      return counts;
    },
  });
}

export function RevisionComparisonPanel({ solicitationId }: Props) {
  const { data: revisions, isLoading } = useRevisions(solicitationId);
  const { data: docCounts } = useRevisionDocCounts(solicitationId);
  const { data: solicitation } = useSolicitation(solicitationId);
  const { changes, summary } = useComparisonResults(solicitationId);
  const { data: reviewedSet } = useRevisionReviews(solicitationId);
  const markReviewed = useMarkRevisionReviewed(solicitationId);
  const unmarkReviewed = useUnmarkRevisionReviewed(solicitationId);
  const [aId, setAId] = useState<string | null>(null);
  const [bId, setBId] = useState<string | null>(null);
  const [mode, setMode] = useState<ComparisonMode>("incremental");
  const [addOpen, setAddOpen] = useState(false);

  // Default selection: latest two
  useEffect(() => {
    if (!revisions || revisions.length === 0) return;
    if (aId && bId) return;
    const sorted = [...revisions].sort((x, y) => x.sequence - y.sequence);
    const latest = sorted[sorted.length - 1];
    setBId((prev) => prev ?? latest.id);
    if (mode === "cumulative") {
      setAId((prev) => prev ?? sorted[0].id);
    } else {
      setAId((prev) => prev ?? (sorted.length > 1 ? sorted[sorted.length - 2].id : sorted[0].id));
    }
  }, [revisions, aId, bId, mode]);

  // Mode switch updates A relative to B
  useEffect(() => {
    if (!revisions || !bId) return;
    const sorted = [...revisions].sort((x, y) => x.sequence - y.sequence);
    const bIdx = sorted.findIndex((r) => r.id === bId);
    if (bIdx <= 0) return;
    if (mode === "cumulative") setAId(sorted[0].id);
    else setAId(sorted[bIdx - 1].id);
  }, [mode, bId, revisions]);

  const revA = useMemo(() => revisions?.find((r) => r.id === aId) ?? null, [revisions, aId]);
  const revB = useMemo(() => revisions?.find((r) => r.id === bId) ?? null, [revisions, bId]);
  const { data: matches } = useDocumentMatching(solicitationId, aId, bId);

  const selectAlternating = (id: string) => {
    if (!aId) return setAId(id);
    if (!bId || id === aId) return setBId(id);
    // Toggle: replace whichever was set least recently (just swap A)
    setAId(bId);
    setBId(id);
  };

  const handleExport = async (format: "pdf" | "docx") => {
    if (!revA || !revB || !matches) return;
    const input = {
      solicitationTitle: solicitation?.title ?? "Solicitation",
      revisionA: revA,
      revisionB: revB,
      mode,
      matches,
      aiSummary: summary,
      recommendations: changes?.recommendations ?? [],
    };
    try {
      if (format === "pdf") exportChangeReportPdf(input);
      else await exportChangeReportWord(input);
      toast({ title: "Change report exported" });
    } catch (e) {
      toast({ title: "Export failed", description: e instanceof Error ? e.message : String(e), variant: "destructive" });
    }
  };

  if (isLoading) return <Skeleton className="h-48 w-full" />;

  if (!revisions || revisions.length < 2) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base"><GitBranch className="h-4 w-4" /> Revisions</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-muted-foreground">
            Track every package revision (pre-solicitation, amendments, final RFP) so you can compare any two and see exactly what changed.
          </p>
          <p className="text-sm text-muted-foreground">
            {revisions?.length === 1
              ? "You currently have 1 revision. Add another after the agency posts an amendment, or upload it manually."
              : "No revisions yet."}
          </p>
          <Button onClick={() => setAddOpen(true)}><FileText className="h-4 w-4 mr-2" /> Add revision</Button>
        </CardContent>
        <AddRevisionDialog open={addOpen} onClose={() => setAddOpen(false)} solicitationId={solicitationId} />
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <RevisionTimeline
        revisions={[...revisions].sort((a, b) => a.sequence - b.sequence)}
        selectedAId={aId}
        selectedBId={bId}
        onSelect={selectAlternating}
        onAddRevision={() => setAddOpen(true)}
        docCounts={docCounts ?? {}}
      />

      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <CardTitle className="text-base flex items-center gap-2">
              <GitBranch className="h-4 w-4" /> Revision comparison
            </CardTitle>
            <div className="flex items-center gap-3 flex-wrap">
              <ComparisonModeToggle mode={mode} onChange={setMode} />
              {revB && (
                reviewedSet?.has(revB.id) ? (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => unmarkReviewed.mutate(revB.id)}
                    disabled={unmarkReviewed.isPending}
                  >
                    <Eye className="h-4 w-4 mr-1" /> Mark unreviewed
                  </Button>
                ) : (
                  <Button
                    size="sm"
                    variant="default"
                    onClick={() => markReviewed.mutate(revB.id, {
                      onSuccess: () => toast({ title: `Marked ${revB.label} reviewed` }),
                    })}
                    disabled={markReviewed.isPending}
                  >
                    <Check className="h-4 w-4 mr-1" /> Mark revision reviewed
                  </Button>
                )
              )}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button size="sm" variant="outline" disabled={!revA || !revB}>
                    <Download className="h-4 w-4 mr-1" /> Export change report
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={() => handleExport("pdf")}>PDF</DropdownMenuItem>
                  <DropdownMenuItem onClick={() => handleExport("docx")}>Word (.docx)</DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <RevisionPicker
            revisions={[...revisions].sort((a, b) => a.sequence - b.sequence)}
            aId={aId}
            bId={bId}
            onChange={(n) => { setAId(n.aId); setBId(n.bId); }}
          />
          <DocumentMatchPanel solicitationId={solicitationId} revisionAId={aId} revisionBId={bId} />
        </CardContent>
      </Card>

      <AddRevisionDialog open={addOpen} onClose={() => setAddOpen(false)} solicitationId={solicitationId} />
    </div>
  );
}
