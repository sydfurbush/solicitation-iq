import { Link } from "react-router-dom";
import { format } from "date-fns";
import { ArrowRight, FileText, FileBarChart, Calendar } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useClientUser } from "@/features/portal/hooks/useClientUser";
import { useClientSolicitations, useAllClientReports } from "@/features/portal/hooks/useClientPortal";

export default function PortalDashboard() {
  const { clientUser, client } = useClientUser();
  const { data: solicitations = [] } = useClientSolicitations();
  const { data: reports = [] } = useAllClientReports();

  const upcoming = solicitations
    .filter((s: any) => s.proposal_due_date && new Date(s.proposal_due_date) > new Date())
    .sort(
      (a: any, b: any) =>
        new Date(a.proposal_due_date).getTime() - new Date(b.proposal_due_date).getTime(),
    )
    .slice(0, 5);

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      <div>
        <h1 className="text-3xl font-bold">
          Welcome{clientUser?.full_name ? `, ${clientUser.full_name.split(" ")[0]}` : ""}
        </h1>
        <p className="text-muted-foreground">
          Here's the latest on {client?.name ?? "your solicitations"}.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <StatCard label="Active solicitations" value={solicitations.length} icon={FileText} />
        <StatCard label="Reports available" value={reports.length} icon={FileBarChart} />
        <StatCard label="Upcoming deadlines" value={upcoming.length} icon={Calendar} />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader className="flex-row items-center justify-between">
            <CardTitle className="text-base">Active solicitations</CardTitle>
            <Button asChild variant="ghost" size="sm">
              <Link to="/portal/solicitations">View all <ArrowRight className="h-4 w-4 ml-1" /></Link>
            </Button>
          </CardHeader>
          <CardContent className="space-y-2">
            {solicitations.slice(0, 5).map((s: any) => (
              <Link
                key={s.id}
                to={`/portal/solicitations/${s.id}`}
                className="block p-3 rounded-md border hover:bg-muted/50 transition-colors"
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="font-medium truncate">{s.title}</div>
                  <Badge variant="outline" className="capitalize">{s.status}</Badge>
                </div>
                {s.solicitation_number && (
                  <div className="text-xs text-muted-foreground mt-1">{s.solicitation_number}</div>
                )}
              </Link>
            ))}
            {solicitations.length === 0 && (
              <p className="text-sm text-muted-foreground">No active solicitations.</p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex-row items-center justify-between">
            <CardTitle className="text-base">Recent reports</CardTitle>
            <Button asChild variant="ghost" size="sm">
              <Link to="/portal/solicitations">View all <ArrowRight className="h-4 w-4 ml-1" /></Link>
            </Button>
          </CardHeader>
          <CardContent className="space-y-2">
            {reports.slice(0, 5).map((r: any) => (
              <Link
                key={r.id}
                to={`/portal/solicitations/${r.solicitation_id}/reports`}
                className="block p-3 rounded-md border hover:bg-muted/50 transition-colors"
              >
                <div className="font-medium truncate">{r.title}</div>
                <div className="text-xs text-muted-foreground mt-1">
                  {r.solicitation?.title} · {format(new Date(r.generated_at), "PP")}
                </div>
              </Link>
            ))}
            {reports.length === 0 && (
              <p className="text-sm text-muted-foreground">No reports published yet.</p>
            )}
          </CardContent>
        </Card>
      </div>

      {upcoming.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Key dates</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {upcoming.map((s: any) => (
              <div key={s.id} className="flex items-center justify-between border-b last:border-0 py-2">
                <div className="min-w-0">
                  <div className="font-medium truncate">{s.title}</div>
                  <div className="text-xs text-muted-foreground">Proposal due</div>
                </div>
                <Badge>{format(new Date(s.proposal_due_date), "PP")}</Badge>
              </div>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function StatCard({ label, value, icon: Icon }: { label: string; value: number; icon: any }) {
  return (
    <Card>
      <CardContent className="p-5 flex items-center gap-4">
        <div className="h-10 w-10 rounded-md bg-primary/10 text-primary grid place-items-center">
          <Icon className="h-5 w-5" />
        </div>
        <div>
          <div className="text-2xl font-bold">{value}</div>
          <div className="text-xs text-muted-foreground">{label}</div>
        </div>
      </CardContent>
    </Card>
  );
}
