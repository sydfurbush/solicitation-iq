import { useState } from "react";
import { format } from "date-fns";
import { AlertTriangle, Check, FileText, RefreshCw, Sparkles, X } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { toast } from "@/hooks/use-toast";
import {
  useFieldProposals,
  useDecideProposal,
  useReconcileOverview,
  type FieldProposal,
} from "../hooks/useFieldProposals";

const FIELD_LABELS: Record<string, string> = {
  release_date: "Released",
  questions_due_date: "Questions due",
  proposal_due_date: "Proposal due",
  expected_award_date: "Expected award",
  period_of_performance_start: "PoP start",
  period_of_performance_end: "PoP end",
  estimated_value_low: "Estimated value (low)",
  estimated_value_high: "Estimated value (high)",
  issuing_agency: "Issuing agency",
  agency_type: "Agency type",
  contract_type: "Contract type",
  set_aside: "Set-aside",
  solicitation_number: "Solicitation #",
  incumbent_name: "Incumbent",
  incumbent_contract_number: "Incumbent contract #",
};

const DATE_FIELDS = new Set([
  "release_date",
  "questions_due_date",
  "proposal_due_date",
  "expected_award_date",
  "period_of_performance_start",
  "period_of_performance_end",
]);

function formatVal(field: string, v: unknown): string {
  if (v === null || v === undefined || v === "") return "—";
  if (DATE_FIELDS.has(field)) {
    try {
      return format(new Date(String(v)), "MMM d, yyyy");
    } catch {
      return String(v);
    }
  }
  if (field.startsWith("estimated_value")) {
    const n = Number(v);
    if (Number.isFinite(n)) return `$${n.toLocaleString()}`;
  }
  return String(v);
}

interface AutofillEntry {
  source_document_name?: string;
  quote?: string;
  confidence?: number | null;
  filled_at?: string;
}

export function AutofillChip({
  field,
  autofill,
}: {
  field: string;
  autofill: Record<string, unknown> | null | undefined;
}) {
  const entry = (autofill ?? {})[field] as AutofillEntry | undefined;
  if (!entry) return null;
  return (
    <TooltipProvider delayDuration={150}>
      <Tooltip>
        <TooltipTrigger asChild>
          <Badge variant="secondary" className="ml-2 h-5 gap-1 px-1.5 text-[10px] font-normal">
            <Sparkles className="h-3 w-3" />
            Auto
          </Badge>
        </TooltipTrigger>
        <TooltipContent className="max-w-xs">
          <p className="text-xs font-medium mb-1">Auto-filled from documents</p>
          {entry.source_document_name && (
            <p className="text-xs text-muted-foreground flex items-center gap-1">
              <FileText className="h-3 w-3" /> {entry.source_document_name}
            </p>
          )}
          {entry.quote && (
            <p className="mt-1 text-xs italic border-l-2 pl-2">"{entry.quote}"</p>
          )}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

export function OverviewProposalsCard({ solicitationId }: { solicitationId: string }) {
  const { data: proposals = [], isLoading } = useFieldProposals(solicitationId);
  const decide = useDecideProposal(solicitationId);
  const reconcile = useReconcileOverview(solicitationId);
  const [open, setOpen] = useState(true);

  const pending = proposals.filter((p) => p.status === "pending");

  if (isLoading) return null;

  return (
    <>
      {pending.length > 0 && (
        <Alert className="mb-4 border-amber-500/50 bg-amber-500/5">
          <AlertTriangle className="h-4 w-4 text-amber-600" />
          <AlertTitle className="flex items-center justify-between">
            <span>{pending.length} proposed update{pending.length === 1 ? "" : "s"} from documents</span>
            <Button variant="ghost" size="sm" onClick={() => setOpen((v) => !v)}>
              {open ? "Hide" : "Review"}
            </Button>
          </AlertTitle>
          <AlertDescription>
            Uploaded documents suggest different values than the ones currently saved. Review and accept or reject each one.
          </AlertDescription>

          {open && (
            <div className="mt-3 space-y-2">
              {pending.map((p) => (
                <ProposalRow
                  key={p.id}
                  proposal={p}
                  onAccept={() =>
                    decide.mutate(
                      { proposal: p, action: "accept" },
                      {
                        onSuccess: () => toast({ title: `${FIELD_LABELS[p.field_name] ?? p.field_name} updated` }),
                        onError: (e) => toast({ title: "Failed", description: String(e), variant: "destructive" }),
                      }
                    )
                  }
                  onReject={() =>
                    decide.mutate(
                      { proposal: p, action: "reject" },
                      { onSuccess: () => toast({ title: "Proposal dismissed" }) }
                    )
                  }
                  busy={decide.isPending}
                />
              ))}
            </div>
          )}
        </Alert>
      )}

      <Card className="mb-4">
        <CardHeader className="pb-2 flex-row items-center justify-between space-y-0">
          <CardTitle className="text-sm flex items-center gap-2">
            <Sparkles className="h-4 w-4" />
            Document auto-fill
          </CardTitle>
          <Button
            variant="outline"
            size="sm"
            disabled={reconcile.isPending}
            onClick={() =>
              reconcile.mutate(undefined, {
                onSuccess: (r) =>
                  toast({
                    title: "Re-scan complete",
                    description: `${r.filled} filled, ${r.proposed} proposed`,
                  }),
                onError: (e) => toast({ title: "Re-scan failed", description: String(e), variant: "destructive" }),
              })
            }
          >
            <RefreshCw className={`h-3.5 w-3.5 mr-1.5 ${reconcile.isPending ? "animate-spin" : ""}`} />
            Re-scan documents
          </Button>
        </CardHeader>
        <CardContent className="text-xs text-muted-foreground pt-0">
          Empty overview fields are auto-filled from uploaded documents. Conflicts with values you've edited come back here for review.
        </CardContent>
      </Card>
    </>
  );
}

function ProposalRow({
  proposal,
  onAccept,
  onReject,
  busy,
}: {
  proposal: FieldProposal;
  onAccept: () => void;
  onReject: () => void;
  busy: boolean;
}) {
  return (
    <div className="rounded-md border bg-background p-2 text-xs">
      <div className="font-medium">{FIELD_LABELS[proposal.field_name] ?? proposal.field_name}</div>
      <div className="mt-1 grid grid-cols-2 gap-2">
        <div>
          <p className="text-[10px] uppercase text-muted-foreground">Current</p>
          <p className="font-medium">{formatVal(proposal.field_name, proposal.current_value)}</p>
        </div>
        <div>
          <p className="text-[10px] uppercase text-muted-foreground">Proposed</p>
          <p className="font-medium text-amber-700">{formatVal(proposal.field_name, proposal.proposed_value)}</p>
        </div>
      </div>
      {proposal.source_quote && (
        <p className="mt-1 text-[11px] italic text-muted-foreground border-l-2 pl-2">
          "{proposal.source_quote}"
        </p>
      )}
      <div className="mt-2 flex items-center justify-end gap-2">
        <Button size="sm" variant="ghost" disabled={busy} onClick={onReject}>
          <X className="h-3.5 w-3.5 mr-1" /> Reject
        </Button>
        <Button size="sm" disabled={busy} onClick={onAccept}>
          <Check className="h-3.5 w-3.5 mr-1" /> Accept
        </Button>
      </div>
    </div>
  );
}
