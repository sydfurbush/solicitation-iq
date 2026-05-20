import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { CheckCircle2, Loader2, RotateCcw, Lock } from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/utils";
import { toast } from "@/hooks/use-toast";
import {
  SEVERITY_BADGE,
  SEVERITY_LABEL,
  STATUS_PILL_OPEN,
  STATUS_STRIPE_OPEN,
  type RiskSeverity,
} from "@/features/risks/utils/riskHelpers";
import {
  useRisks,
  useUpdateRisk,
  useMarkRiskMitigated,
  type RiskRow,
} from "@/features/risks/hooks/useRisks";

interface Props {
  solicitationId: string;
  canEdit: boolean;
}

export function ClientRiskTracker({ solicitationId, canEdit }: Props) {
  const { data: risks = [], isLoading } = useRisks(solicitationId);
  const updateRisk = useUpdateRisk(solicitationId);
  const markMitigated = useMarkRiskMitigated(solicitationId);

  const total = risks.length;
  const open = risks.filter((r) => !r.is_mitigated);
  const mitigatedList = risks.filter((r) => r.is_mitigated);
  const mitigated = mitigatedList.length;
  const pct = total ? Math.round((mitigated / total) * 100) : 0;

  const handleReopen = async (r: RiskRow) => {
    const ok = window.confirm("Reopen this risk? It will move back to Open.");
    if (!ok) return;
    try {
      await markMitigated.mutateAsync({ id: r.id, isMitigated: false });
      toast({ title: "Risk reopened", description: r.title });
    } catch (e) {
      toast({
        title: "Could not reopen risk",
        description: e instanceof Error ? e.message : String(e),
        variant: "destructive",
      });
    }
  };

  if (isLoading) {
    return (
      <Card>
        <CardContent className="p-8 text-center text-muted-foreground">Loading risks…</CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardContent className="p-5 space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="font-semibold">Risk mitigation</h3>
            <p className="text-xs text-muted-foreground">
              {mitigated} of {total} risks mitigated
            </p>
          </div>
          <span className="text-2xl font-bold">{pct}%</span>
        </div>
        <Progress value={pct} className="h-2" />

        {total === 0 ? (
          <p className="text-sm text-center text-muted-foreground py-6">No risks identified yet.</p>
        ) : (
          <div className="space-y-4">
            {open.length > 0 && (
              <div className="space-y-3">
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                  Open ({open.length})
                </p>
                {open.map((r) => {
                  const sent = (r as any).sent_to_client === true;
                  return sent && canEdit ? (
                    <ClientEditableRow
                      key={r.id}
                      risk={r}
                      onSave={(notes) =>
                        updateRisk.mutateAsync({
                          id: r.id,
                          updates: { mitigation_strategy: notes },
                        })
                      }
                      onMarkMitigated={async (notes) => {
                        const trimmed = notes.trim();
                        if (trimmed && trimmed !== (r.mitigation_strategy ?? "")) {
                          await updateRisk.mutateAsync({
                            id: r.id,
                            updates: { mitigation_strategy: trimmed },
                          });
                        }
                        await markMitigated.mutateAsync({ id: r.id, isMitigated: true });
                      }}
                      saving={updateRisk.isPending || markMitigated.isPending}
                    />
                  ) : (
                    <ReadOnlyRow key={r.id} risk={r} awaiting={sent && !canEdit} />
                  );
                })}
              </div>
            )}

            {mitigatedList.length > 0 && (
              <div className="space-y-3">
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                  Mitigated ({mitigatedList.length})
                </p>
                {mitigatedList.map((r) => {
                  const sent = (r as any).sent_to_client === true;
                  return (
                    <MitigatedRow
                      key={r.id}
                      risk={r}
                      canReopen={sent && canEdit}
                      onReopen={() => handleReopen(r)}
                      isReopening={markMitigated.isPending}
                    />
                  );
                })}
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function ReadOnlyRow({ risk, awaiting }: { risk: RiskRow; awaiting: boolean }) {
  const sev = (risk.severity ?? "medium") as RiskSeverity;
  return (
    <div className={cn("rounded-md border p-3 space-y-2", STATUS_STRIPE_OPEN)}>
      <div className="flex items-center gap-2 flex-wrap">
        <Badge className={cn("border", SEVERITY_BADGE[sev])}>{SEVERITY_LABEL[sev]}</Badge>
        <Badge variant="outline" className={cn("text-[10px] gap-1", STATUS_PILL_OPEN)}>
          <span className="h-1.5 w-1.5 rounded-full bg-amber-500" /> Open
        </Badge>
        {!awaiting && (
          <Badge variant="outline" className="text-[10px] gap-1">
            <Lock className="h-3 w-3" /> View only
          </Badge>
        )}
      </div>
      <p className="font-medium text-sm">{risk.title}</p>
      {risk.description && (
        <p className="text-xs text-muted-foreground whitespace-pre-wrap">{risk.description}</p>
      )}
      {risk.mitigation_strategy && (
        <div className="text-xs">
          <p className="text-muted-foreground font-medium mb-0.5">Current mitigation notes:</p>
          <p className="whitespace-pre-wrap">{risk.mitigation_strategy}</p>
        </div>
      )}
    </div>
  );
}

function ClientEditableRow({
  risk,
  onSave,
  onMarkMitigated,
  saving,
}: {
  risk: RiskRow;
  onSave: (notes: string) => Promise<unknown>;
  onMarkMitigated: (notes: string) => Promise<unknown>;
  saving: boolean;
}) {
  const saved = risk.mitigation_strategy ?? "";
  const [notes, setNotes] = useState(saved);
  const sev = (risk.severity ?? "medium") as RiskSeverity;
  const hasUnsaved = notes !== saved;

  return (
    <div className={cn("rounded-md border p-3 space-y-2 border-blue-500/40 bg-blue-500/5")}>
      <div className="flex items-center gap-2 flex-wrap">
        <Badge className={cn("border", SEVERITY_BADGE[sev])}>{SEVERITY_LABEL[sev]}</Badge>
        <Badge variant="outline" className="text-[10px] gap-1 border-blue-500/40 bg-blue-500/10 text-blue-700 dark:text-blue-300">
          Needs your input
        </Badge>
      </div>
      <p className="font-medium text-sm">{risk.title}</p>
      {risk.description && (
        <p className="text-xs text-muted-foreground whitespace-pre-wrap">{risk.description}</p>
      )}
      <Textarea
        rows={3}
        value={notes}
        onChange={(e) => setNotes(e.target.value)}
        placeholder="Add your mitigation notes…"
      />
      <div className="flex justify-end gap-2 flex-wrap">
        <Button
          size="sm"
          variant="outline"
          disabled={!hasUnsaved || saving}
          onClick={async () => {
            try {
              await onSave(notes);
              toast({ title: "Notes saved" });
            } catch (e) {
              toast({
                title: "Could not save notes",
                description: e instanceof Error ? e.message : String(e),
                variant: "destructive",
              });
            }
          }}
        >
          Save notes
        </Button>
        <Button
          size="sm"
          disabled={notes.trim().length === 0 || saving}
          onClick={async () => {
            try {
              await onMarkMitigated(notes);
              toast({ title: "Marked mitigated" });
            } catch (e) {
              toast({
                title: "Could not mark mitigated",
                description: e instanceof Error ? e.message : String(e),
                variant: "destructive",
              });
            }
          }}
        >
          {saving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <CheckCircle2 className="h-4 w-4 mr-2" />}
          Mark mitigated
        </Button>
      </div>
    </div>
  );
}

function MitigatedRow({
  risk,
  canReopen,
  onReopen,
  isReopening,
}: {
  risk: RiskRow;
  canReopen: boolean;
  onReopen: () => void;
  isReopening: boolean;
}) {
  const sev = (risk.severity ?? "medium") as RiskSeverity;
  const notes = risk.mitigation_strategy ?? "";
  return (
    <div className="rounded-md border p-3 space-y-2 bg-emerald-500/5 border-emerald-500/30">
      <div className="flex items-start justify-between gap-2">
        <div className="space-y-1 min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <Badge className={cn("border", SEVERITY_BADGE[sev])}>{SEVERITY_LABEL[sev]}</Badge>
            <Badge variant="outline" className="text-[10px] gap-1 border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300">
              <CheckCircle2 className="h-3 w-3" /> Mitigated
            </Badge>
          </div>
          <p className="font-medium text-sm">{risk.title}</p>
          {notes && (
            <p className="text-xs text-muted-foreground whitespace-pre-wrap line-clamp-3">{notes}</p>
          )}
        </div>
        {canReopen && (
          <Button size="sm" variant="outline" onClick={onReopen} disabled={isReopening}>
            {isReopening ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <RotateCcw className="h-4 w-4 mr-2" />
            )}
            Reopen
          </Button>
        )}
      </div>
    </div>
  );
}
