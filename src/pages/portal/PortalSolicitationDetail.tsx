import { Link, useParams } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
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

export default function PortalSolicitationDetail() {
  const { id } = useParams<{ id: string }>();
  const { data: sol, isLoading } = useClientSolicitation(id);
  const { data: reports = [] } = useClientReports(id);
  const { client } = useClientUser();

  const accessLevel = (client?.access_level as "full" | "summary" | "restricted") ?? "summary";
  const hasFullAccess = accessLevel === "full";

  if (isLoading) return <Skeleton className="h-96 w-full" />;
  if (!sol)
    return (
      <Card>
        <CardContent className="p-8 text-center text-muted-foreground">
          Solicitation not found.
        </CardContent>
      </Card>
    );

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

      <Tabs defaultValue="overview">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="reports">Reports</TabsTrigger>
          {hasFullAccess && <TabsTrigger value="analysis">Analysis</TabsTrigger>}
          {hasFullAccess && <TabsTrigger value="questions">Questions</TabsTrigger>}
          {hasFullAccess && <TabsTrigger value="annotations">Annotations</TabsTrigger>}
        </TabsList>

        <TabsContent value="overview" className="space-y-4 mt-4">
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
          <TabsContent value="questions" className="mt-4">
            <Card>
              <CardContent className="p-6 text-sm text-muted-foreground">
                Strategic questions visible to your account team will appear here.
              </CardContent>
            </Card>
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

function Row({ label, value }: { label: string; value?: string | null }) {
  return (
    <div className="flex justify-between gap-4">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium text-right">{value || "—"}</span>
    </div>
  );
}
