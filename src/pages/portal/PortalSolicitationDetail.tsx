import { Link, useParams } from "react-router-dom";
import { ArrowLeft, Check, AlertCircle, Clock, CircleDashed } from "lucide-react";
import { format } from "date-fns";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useClientSolicitation, useClientReports } from "@/features/portal/hooks/useClientPortal";
import { useClientUser } from "@/features/portal/hooks/useClientUser";
import { ClientAnnotations } from "@/features/portal/components/ClientAnnotations";
import { ClientReportViewer } from "@/features/portal/components/ClientReportViewer";
import { ClientQuestionTriage } from "@/features/portal/components/ClientQuestionTriage";
import { ClientClarificationPackage } from "@/features/portal/components/ClientClarificationPackage";
import { ClientRiskTracker } from "@/features/portal/components/ClientRiskTracker";
import { ClientGapTracker } from "@/features/portal/components/ClientGapTracker";
import { usePhaseApprovals, APPROVAL_LABEL, type PhaseApproval } from "@/features/phases/hooks/usePhaseApprovals";
import { PhaseApprovalStrip } from "@/features/phases/components/PhaseApprovalStrip";
import { ApprovalActionBanner } from "@/features/phases/components/ApprovalActionBanner";
import { ApprovalsTimeline } from "@/features/phases/components/ApprovalsTimeline";
import { ExportApprovalsButton } from "@/features/phases/components/ExportApprovalsButton";
import { type PhaseType } from "@/lib/validators/solicitation";

const PHASE_LABELS: Record<PhaseType, string> = {
  phase_1_initial: "Initial",
  phase_2_deep_dive: "Deep Dive",
  phase_3_outline: "Proposal Development",
};

export default function PortalSolicitationDetail() {
  const { id } = useParams<{ id: string }>();
  const { data: sol, isLoading } = useClientSolicitation(id);
  const { data: reports = [] } = useClientReports(id);
  const { client, clientUser } = useClientUser();
  const { approvals, byPhase } = usePhaseApprovals(id);

  const accessLevel = (client?.access_level as "full" | "summary" | "restricted") ?? "summary";
  const hasFullAccess = accessLevel === "full";
  const canApprove = accessLevel === "full" || accessLevel === "restricted";

  if (isLoading) return <Skeleton className="h-96 w-full" />;
  if (!sol)
    return (
      <Card>
        <CardContent className="p-8 text-center text-muted-foreground">
          Solicitation not found.
        </CardContent>
      </Card>
    );

  const pending = canApprove
    ? approvals.find((a) => a.status === "pending_review")
    : undefined;
  const deciderName = clientUser?.full_name ?? clientUser?.email ?? null;

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      <Button asChild variant="ghost" size="sm">
        <Link to="/portal/solicitations"><ArrowLeft className="h-4 w-4 mr-1" /> Back</Link>
      </Button>

      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold">{sol.title}</h1>
          <div className="flex flex-wrap gap-2 mt-2 text-sm text-muted-foreground">
            {sol.solicitation_number && <span>{sol.solicitation_number}</span>}
            {sol.issuing_agency && <span>· {sol.issuing_agency}</span>}
          </div>
        </div>
        <div className="flex gap-2">
          <Badge variant="outline" className="capitalize">{sol.status}</Badge>
          <Badge variant="secondary" className="capitalize">{accessLevel} access</Badge>
        </div>
      </div>

      {/* Phase status strip — visible to all access levels */}
      <PhaseApprovalStrip byPhase={byPhase} />

      {/* Action banner when something needs the client's review */}
      {pending && id && (
        <ApprovalActionBanner pending={pending} solicitationId={id} deciderName={deciderName} />
      )}

      <Tabs defaultValue="overview">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="reports">Reports</TabsTrigger>
          {hasFullAccess && <TabsTrigger value="analysis">Analysis</TabsTrigger>}
          {hasFullAccess && <TabsTrigger value="questions">Questions</TabsTrigger>}
          {hasFullAccess && <TabsTrigger value="risks">Risks</TabsTrigger>}
          {hasFullAccess && <TabsTrigger value="gaps">Gaps</TabsTrigger>}
          {hasFullAccess && <TabsTrigger value="annotations">Annotations</TabsTrigger>}
        </TabsList>

        <TabsContent value="overview" className="space-y-4 mt-4">
          {canApprove && (
            <>
              <div className="flex justify-end">
                <ExportApprovalsButton
                  solicitationId={id}
                  solicitation={{
                    title: sol.title,
                    solicitation_number: sol.solicitation_number,
                    issuing_agency: sol.issuing_agency,
                    client: { name: client?.name ?? null },
                  }}
                />
              </div>
              <ApprovalsCard approvals={approvals} />
            </>
          )}

          {canApprove && <ApprovalsTimeline solicitationId={id} />}

          <Card>
            <CardHeader><CardTitle className="text-base">Summary</CardTitle></CardHeader>
            <CardContent>
              <p className="text-sm whitespace-pre-wrap">
                {sol.ai_summary || "No summary available yet."}
              </p>
            </CardContent>
          </Card>
          <div className="grid md:grid-cols-2 gap-4">
            <Card>
              <CardHeader><CardTitle className="text-base">Key dates</CardTitle></CardHeader>
              <CardContent className="space-y-2 text-sm">
                <Row label="Release" value={sol.release_date && format(new Date(sol.release_date), "PP")} />
                <Row label="Questions due" value={sol.questions_due_date && format(new Date(sol.questions_due_date), "PP")} />
                <Row label="Proposal due" value={sol.proposal_due_date && format(new Date(sol.proposal_due_date), "PP")} />
                <Row label="Award" value={sol.expected_award_date && format(new Date(sol.expected_award_date), "PP")} />
              </CardContent>
            </Card>
            <Card>
              <CardHeader><CardTitle className="text-base">Contract</CardTitle></CardHeader>
              <CardContent className="space-y-2 text-sm">
                <Row label="Type" value={sol.contract_type} />
                <Row label="Estimated value" value={
                  sol.estimated_value_low || sol.estimated_value_high
                    ? `${sol.estimated_value_low ?? "?"} – ${sol.estimated_value_high ?? "?"}`
                    : null
                } />
                <Row label="Incumbent" value={sol.incumbent_name} />
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="reports" className="space-y-3 mt-4">
          {reports.length === 0 ? (
            <Card><CardContent className="p-8 text-center text-muted-foreground">
              No published reports yet.
            </CardContent></Card>
          ) : (
            reports.map((r: any) => <ClientReportViewer key={r.id} report={r} />)
          )}
        </TabsContent>

        {hasFullAccess && (
          <TabsContent value="analysis" className="space-y-4 mt-4">
            <Card>
              <CardHeader><CardTitle className="text-base">Key requirements</CardTitle></CardHeader>
              <CardContent>
                {Array.isArray(sol.key_requirements) && sol.key_requirements.length > 0 ? (
                  <ul className="space-y-2 text-sm">
                    {(sol.key_requirements as any[]).map((r, i) => (
                      <li key={i} className="border-b pb-2 last:border-0">
                        <div className="font-medium">{r.title ?? r.name ?? `Requirement ${i + 1}`}</div>
                        {r.description && <div className="text-muted-foreground text-xs mt-1">{r.description}</div>}
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-sm text-muted-foreground">No requirements extracted yet.</p>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        )}

        {hasFullAccess && (
          <TabsContent value="questions" className="mt-4 space-y-4">
            <ClientClarificationPackage solicitationId={id!} solicitationTitle={sol.title} />
            <ClientQuestionTriage
              solicitationId={id!}
              solicitationTitle={sol.title}
              questionsDueDate={sol.questions_due_date}
            />
          </TabsContent>
        )}

        {hasFullAccess && (
          <TabsContent value="risks" className="mt-4">
            <ClientRiskTracker solicitationId={id!} canEdit={hasFullAccess} />
          </TabsContent>
        )}

        {hasFullAccess && (
          <TabsContent value="gaps" className="mt-4">
            <ClientGapTracker solicitationId={id!} canEdit={hasFullAccess} />
          </TabsContent>
        )}

        {hasFullAccess && (
          <TabsContent value="annotations" className="mt-4">
            <ClientAnnotations solicitationId={id!} hasFullAccess={hasFullAccess} />
          </TabsContent>
        )}
      </Tabs>
    </div>
  );
}

function ApprovalsCard({ approvals }: { approvals: PhaseApproval[] }) {
  const sorted = [...approvals].sort((a, b) => a.phase.localeCompare(b.phase));
  if (sorted.length === 0) {
    return (
      <Card>
        <CardHeader><CardTitle className="text-base">Approvals</CardTitle></CardHeader>
        <CardContent className="text-sm text-muted-foreground">
          No phases have been sent for your review yet.
        </CardContent>
      </Card>
    );
  }
  return (
    <Card>
      <CardHeader><CardTitle className="text-base">Approvals</CardTitle></CardHeader>
      <CardContent className="space-y-3">
        {sorted.map((a) => {
          const Icon =
            a.status === "approved" ? Check
            : a.status === "pending_review" ? Clock
            : a.status === "changes_requested" ? AlertCircle
            : CircleDashed;
          const tone =
            a.status === "approved" ? "text-accent"
            : a.status === "pending_review" ? "text-amber-600 dark:text-amber-400"
            : a.status === "changes_requested" ? "text-destructive"
            : "text-muted-foreground";
          return (
            <div key={a.id} className="flex items-start gap-3 text-sm">
              <Icon className={`h-4 w-4 mt-0.5 ${tone}`} />
              <div className="flex-1 min-w-0">
                <div className="font-medium">
                  {PHASE_LABELS[a.phase]} · <span className={tone}>{APPROVAL_LABEL[a.status]}</span>
                </div>
                {a.decided_at && (
                  <div className="text-xs text-muted-foreground">
                    {a.decided_by_name ?? "Client"} · {format(new Date(a.decided_at), "PPp")}
                  </div>
                )}
                {a.decision_note && (
                  <div className="text-xs italic text-muted-foreground mt-1">"{a.decision_note}"</div>
                )}
              </div>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}

function Row({ label, value }: { label: string; value?: string | null }) {
  return (
    <div className="flex justify-between gap-4">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium text-right">{value || "—"}</span>
    </div>
  );
}
