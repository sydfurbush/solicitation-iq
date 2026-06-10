import { useMemo, useState } from "react";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { toast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { useDocuments } from "@/features/documents/hooks/useDocuments";
import {
  useRisks,
  useCreateRisk,
  useUpdateRisk,
  useDeleteRisk,
  useMarkRiskMitigated,
  type RiskRow,
} from "@/features/risks/hooks/useRisks";
import {
  useOpportunities,
  useCreateOpportunity,
  useUpdateOpportunity,
  useDeleteOpportunity,
  type OpportunityRow,
} from "@/features/opportunities/hooks/useOpportunities";
import { RisksList } from "@/features/risks/components/RisksList";
import { RiskForm } from "@/features/risks/components/RiskForm";
import { RiskHeatmap } from "@/features/risks/components/RiskHeatmap";
import { OpportunitiesList } from "@/features/opportunities/components/OpportunitiesList";
import { OpportunityForm } from "@/features/opportunities/components/OpportunityForm";
import {
  SEVERITY_DOT,
  SEVERITY_LABEL,
  SEVERITY_ORDER,
  OPPORTUNITY_LABEL,
  type RiskSeverity,
} from "@/features/risks/utils/riskHelpers";
import { OPPORTUNITY_TYPES } from "@/lib/validators/riskOpportunity";

interface Props {
  solicitationId: string;
  view?: "combined" | "risks" | "opportunities";
}

export function RisksOpportunitiesDashboard({ solicitationId, view = "combined" }: Props) {
  const { data: risks = [] } = useRisks(solicitationId);
  const { data: opportunities = [] } = useOpportunities(solicitationId);
  const { data: documents = [] } = useDocuments(solicitationId);

  const createRisk = useCreateRisk(solicitationId);
  const updateRisk = useUpdateRisk(solicitationId);
  const deleteRisk = useDeleteRisk(solicitationId);
  const markRiskMitigated = useMarkRiskMitigated(solicitationId);

  const createOpp = useCreateOpportunity(solicitationId);
  const updateOpp = useUpdateOpportunity(solicitationId);
  const deleteOpp = useDeleteOpportunity(solicitationId);

  

  const [riskDialog, setRiskDialog] = useState<{ open: boolean; editing?: RiskRow }>({ open: false });
  const [oppDialog, setOppDialog] = useState<{ open: boolean; editing?: OpportunityRow }>({ open: false });
  const [confirmDelete, setConfirmDelete] = useState<
    | { type: "risk"; row: RiskRow }
    | { type: "opportunity"; row: OpportunityRow }
    | null
  >(null);

  const docs = useMemo(() => documents.map((d) => ({ id: d.id, file_name: d.file_name })), [documents]);

  const sevCounts = useMemo(() => {
    const counts: Record<RiskSeverity, number> = {
      critical: 0, high: 0, medium: 0, low: 0, informational: 0,
    };
    risks.forEach((r) => { counts[(r.severity ?? "medium") as RiskSeverity] += 1; });
    return counts;
  }, [risks]);

  const oppCounts = useMemo(() => {
    const counts = new Map<string, number>();
    OPPORTUNITY_TYPES.forEach((t) => counts.set(t, 0));
    opportunities.forEach((o) => counts.set(o.opportunity_type, (counts.get(o.opportunity_type) ?? 0) + 1));
    return counts;
  }, [opportunities]);

  const mitigatedCount = risks.filter((r) => r.is_mitigated).length;


  const submitRisk = async (values: Parameters<typeof createRisk.mutate>[0]) => {
    try {
      if (riskDialog.editing) {
        await updateRisk.mutateAsync({ id: riskDialog.editing.id, updates: values });
        toast({ title: "Risk updated" });
      } else {
        await createRisk.mutateAsync(values);
        toast({ title: "Risk added" });
      }
      setRiskDialog({ open: false });
    } catch (e) {
      toast({ title: "Failed", description: e instanceof Error ? e.message : String(e), variant: "destructive" });
    }
  };

  const submitOpp = async (values: Parameters<typeof createOpp.mutate>[0]) => {
    try {
      if (oppDialog.editing) {
        await updateOpp.mutateAsync({ id: oppDialog.editing.id, updates: values });
        toast({ title: "Opportunity updated" });
      } else {
        await createOpp.mutateAsync(values);
        toast({ title: "Opportunity added" });
      }
      setOppDialog({ open: false });
    } catch (e) {
      toast({ title: "Failed", description: e instanceof Error ? e.message : String(e), variant: "destructive" });
    }
  };

  const confirmDeleteAction = async () => {
    if (!confirmDelete) return;
    try {
      if (confirmDelete.type === "risk") {
        await deleteRisk.mutateAsync(confirmDelete.row.id);
        toast({ title: "Risk deleted" });
      } else {
        await deleteOpp.mutateAsync(confirmDelete.row.id);
        toast({ title: "Opportunity deleted" });
      }
      setConfirmDelete(null);
    } catch (e) {
      toast({ title: "Failed", description: e instanceof Error ? e.message : String(e), variant: "destructive" });
    }
  };

  const showRisks = view === "combined" || view === "risks";
  const showOpps = view === "combined" || view === "opportunities";

  return (
    <div className="space-y-6">
      {/* Stats + identify */}
      <div className="grid md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="p-4 space-y-2">
            <p className="text-xs text-muted-foreground uppercase tracking-wide">Risks by severity</p>
            <div className="space-y-1.5">
              {SEVERITY_ORDER.map((sev) => {
                const count = sevCounts[sev];
                const max = Math.max(1, ...Object.values(sevCounts));
                return (
                  <div key={sev} className="flex items-center gap-2 text-xs">
                    <span className={cn("h-2 w-2 rounded-full", SEVERITY_DOT[sev])} />
                    <span className="w-24">{SEVERITY_LABEL[sev]}</span>
                    <div className="flex-1 h-1.5 rounded bg-muted overflow-hidden">
                      <div
                        className={cn("h-full", SEVERITY_DOT[sev])}
                        style={{ width: `${(count / max) * 100}%` }}
                      />
                    </div>
                    <span className="w-6 text-right font-medium">{count}</span>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 space-y-2">
            <p className="text-xs text-muted-foreground uppercase tracking-wide">Opportunities by type</p>
            <div className="space-y-1.5">
              {OPPORTUNITY_TYPES.slice(0, 5).map((t) => (
                <div key={t} className="flex items-center justify-between text-xs">
                  <span className="truncate">{OPPORTUNITY_LABEL[t]}</span>
                  <span className="font-semibold">{oppCounts.get(t) ?? 0}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex flex-col gap-2">
            <p className="text-xs text-muted-foreground uppercase tracking-wide">Mitigation</p>
            <div className="text-3xl font-bold">
              {mitigatedCount}<span className="text-base font-normal text-muted-foreground">/{risks.length}</span>
            </div>
            <p className="text-xs text-muted-foreground">risks mitigated</p>
          </CardContent>
        </Card>
      </div>

      <div className={cn("grid gap-6", view === "combined" ? "lg:grid-cols-2" : "grid-cols-1")}>
        {showRisks && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold">Risks</h2>
              <Button size="sm" variant="outline" onClick={() => setRiskDialog({ open: true })}>
                <Plus className="h-4 w-4 mr-2" /> Add risk
              </Button>
            </div>
            {risks.length > 0 && <RiskHeatmap risks={risks} />}
            {risks.length === 0 ? (
              <Card><CardContent className="py-10 text-center text-sm text-muted-foreground">
                No risks yet. Run AI analysis or add one manually.
              </CardContent></Card>
            ) : (
              <RisksList
                risks={risks}
                onToggleMitigated={(id, next) => markRiskMitigated.mutate({ id, isMitigated: next })}
                onEdit={(r) => setRiskDialog({ open: true, editing: r })}
                onDelete={(r) => setConfirmDelete({ type: "risk", row: r })}
              />
            )}
          </div>
        )}

        {showOpps && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold">Opportunities</h2>
              <Button size="sm" variant="outline" onClick={() => setOppDialog({ open: true })}>
                <Plus className="h-4 w-4 mr-2" /> Add opportunity
              </Button>
            </div>
            {opportunities.length === 0 ? (
              <Card><CardContent className="py-10 text-center text-sm text-muted-foreground">
                No opportunities yet. Run AI analysis or add one manually.
              </CardContent></Card>
            ) : (
              <OpportunitiesList
                opportunities={opportunities}
                onEdit={(o) => setOppDialog({ open: true, editing: o })}
                onDelete={(o) => setConfirmDelete({ type: "opportunity", row: o })}
              />
            )}
          </div>
        )}
      </div>

      {/* Risk dialog */}
      <Dialog open={riskDialog.open} onOpenChange={(open) => setRiskDialog({ open })}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{riskDialog.editing ? "Edit risk" : "Add risk"}</DialogTitle>
          </DialogHeader>
          <RiskForm
            initial={riskDialog.editing}
            documents={docs}
            onSubmit={submitRisk}
            onCancel={() => setRiskDialog({ open: false })}
            submitting={createRisk.isPending || updateRisk.isPending}
          />
        </DialogContent>
      </Dialog>

      {/* Opportunity dialog */}
      <Dialog open={oppDialog.open} onOpenChange={(open) => setOppDialog({ open })}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{oppDialog.editing ? "Edit opportunity" : "Add opportunity"}</DialogTitle>
          </DialogHeader>
          <OpportunityForm
            initial={oppDialog.editing}
            documents={docs}
            onSubmit={submitOpp}
            onCancel={() => setOppDialog({ open: false })}
            submitting={createOpp.isPending || updateOpp.isPending}
          />
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!confirmDelete} onOpenChange={(open) => !open && setConfirmDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete {confirmDelete?.type}?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently remove "{confirmDelete?.row.title}".
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDeleteAction}>Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
