import { useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { ArrowLeft, FileBarChart } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { useClientReports } from "@/features/portal/hooks/useClientPortal";
import { ClientReportViewer } from "@/features/portal/components/ClientReportViewer";

export default function PortalReports() {
  const { id } = useParams<{ id: string }>();
  const { data: reports = [], isLoading } = useClientReports(id);
  const [filter, setFilter] = useState<string>("all");

  const filtered = useMemo(
    () => reports.filter((r: any) => filter === "all" || r.report_type === filter),
    [reports, filter],
  );

  const types = Array.from(new Set(reports.map((r: any) => r.report_type ?? "full")));

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      <Button asChild variant="ghost" size="sm">
        <Link to={`/portal/solicitations/${id}`}>
          <ArrowLeft className="h-4 w-4 mr-1" /> Back to solicitation
        </Link>
      </Button>

      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <FileBarChart className="h-6 w-6" /> Reports
          </h1>
          <p className="text-muted-foreground">Published reports for this solicitation.</p>
        </div>
        <Select value={filter} onValueChange={setFilter}>
          <SelectTrigger className="w-48"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All types</SelectItem>
            {types.map((t) => (
              <SelectItem key={t} value={t}>{t.replace(/_/g, " ")}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {isLoading ? (
        <Skeleton className="h-96 w-full" />
      ) : filtered.length === 0 ? (
        <Card><CardContent className="p-12 text-center text-muted-foreground">
          No reports available.
        </CardContent></Card>
      ) : (
        <div className="space-y-4">
          {filtered.map((r: any) => <ClientReportViewer key={r.id} report={r} />)}
        </div>
      )}
    </div>
  );
}
