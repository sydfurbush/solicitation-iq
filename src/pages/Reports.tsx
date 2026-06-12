import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  BarChart3,
  CheckCircle2,
  Users,
  Briefcase,
  FileText,
  ExternalLink,
  Download,
} from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { PdfToolsMenu } from "@/features/exports/components/PdfToolsMenu";
import {
  usePipeline,
  useOnTimeRate,
  useWorkload,
  useClientPortfolio,
  useDeliverablesLibrary,
  useClientsList,
} from "@/features/reports-hub/hooks/useReportsHub";
import { generateClientPortfolioReport } from "@/features/reports-hub/lib/clientPortfolioPdf";
import { toast } from "@/hooks/use-toast";
import { OrgReportsTab } from "@/features/reports-hub/components/OrgReportsTab";

const STATUS_LABELS: Record<string, string> = {
  intake: "Intake",
  processing: "Processing",
  phase_1_complete: "Phase 1 complete",
  phase_2_active: "Phase 2",
  phase_3_active: "Phase 3",
  complete: "Complete",
  archived: "Archived",
};

const fmtUsd = (n: number) =>
  n >= 1_000_000 ? `$${(n / 1_000_000).toFixed(1)}M` : n >= 1_000 ? `$${(n / 1_000).toFixed(0)}k` : `$${Math.round(n)}`;

function PipelineCard({ clientId }: { clientId: string | null }) {
  const { data = [], isLoading } = usePipeline({ clientId });
  const byStatus = useMemo(() => {
    const map = new Map<string, { count: number; value: number }>();
    for (const row of data) {
      const k = row.status ?? "unknown";
      const cur = map.get(k) ?? { count: 0, value: 0 };
      cur.count += Number(row.solicitation_count);
      cur.value += Number(row.est_value_high_sum);
      map.set(k, cur);
    }
    return Array.from(map.entries()).sort((a, b) => b[1].count - a[1].count);
  }, [data]);
  const total = byStatus.reduce((s, [, v]) => s + v.count, 0);

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2"><BarChart3 className="h-4 w-4" /> Pipeline overview</CardTitle>
      </CardHeader>
      <CardContent>
        {isLoading ? <Skeleton className="h-32" /> : total === 0 ? (
          <p className="text-sm text-muted-foreground">No solicitations yet.</p>
        ) : (
          <ul className="space-y-2">
            {byStatus.map(([status, v]) => (
              <li key={status} className="flex items-center justify-between gap-3 text-sm">
                <span className="text-muted-foreground">{STATUS_LABELS[status] ?? status}</span>
                <span className="flex items-center gap-3">
                  <span className="font-medium tabular-nums">{v.count}</span>
                  <span className="text-xs text-muted-foreground tabular-nums w-16 text-right">{fmtUsd(v.value)}</span>
                </span>
              </li>
            ))}
            <li className="flex items-center justify-between border-t pt-2 mt-2 text-sm font-medium">
              <span>Total</span><span className="tabular-nums">{total}</span>
            </li>
          </ul>
        )}
      </CardContent>
    </Card>
  );
}

function OnTimeCard({ clientId }: { clientId: string | null }) {
  const { data = [], isLoading } = useOnTimeRate({ clientId });
  const totals = data.reduce(
    (acc, r) => ({ ontime: acc.ontime + Number(r.on_time_count), submitted: acc.submitted + Number(r.submitted_count) }),
    { ontime: 0, submitted: 0 },
  );
  const pct = totals.submitted > 0 ? Math.round((totals.ontime / totals.submitted) * 100) : null;

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2"><CheckCircle2 className="h-4 w-4" /> On-time submission</CardTitle>
      </CardHeader>
      <CardContent>
        {isLoading ? <Skeleton className="h-24" /> : (
          <div className="space-y-2">
            <div className="flex items-baseline gap-2">
              <span className="text-3xl font-semibold tabular-nums">{pct == null ? "—" : `${pct}%`}</span>
              <span className="text-xs text-muted-foreground">last 365 days</span>
            </div>
            <p className="text-sm text-muted-foreground">
              {totals.ontime} of {totals.submitted} submitted on or before the proposal due date.
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function WorkloadCard() {
  const { data = [], isLoading } = useWorkload();
  return (
    <Card className="col-span-1 lg:col-span-2">
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2"><Users className="h-4 w-4" /> Team workload & utilization</CardTitle>
      </CardHeader>
      <CardContent>
        {isLoading ? <Skeleton className="h-32" /> : data.length === 0 ? (
          <p className="text-sm text-muted-foreground">No team members.</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Member</TableHead>
                <TableHead className="text-right">Active</TableHead>
                <TableHead className="text-right">Overdue</TableHead>
                <TableHead className="text-right">Hrs (30d)</TableHead>
                <TableHead className="text-right">Cost (30d)</TableHead>
                <TableHead className="text-right">Util.</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.map((r) => {
                const cap30 = Number(r.weekly_capacity_hours) * (30 / 7);
                const util = cap30 > 0 ? Math.round((Number(r.hours_logged_30d) / cap30) * 100) : 0;
                return (
                  <TableRow key={r.user_id}>
                    <TableCell className="font-medium">{r.full_name ?? r.email ?? "Unknown"}</TableCell>
                    <TableCell className="text-right tabular-nums">{r.active_assignments}</TableCell>
                    <TableCell className="text-right tabular-nums">
                      {r.overdue_items > 0 ? <Badge variant="destructive">{r.overdue_items}</Badge> : "0"}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">{Number(r.hours_logged_30d).toFixed(1)}</TableCell>
                    <TableCell className="text-right tabular-nums">{fmtUsd(Number(r.cost_30d))}</TableCell>
                    <TableCell className="text-right tabular-nums">{util}%</TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}

function PortfolioGrid() {
  const { data = [], isLoading } = useClientPortfolio();
  const [generatingId, setGeneratingId] = useState<string | null>(null);
  if (isLoading) return <Skeleton className="h-48" />;
  if (data.length === 0) return <p className="text-sm text-muted-foreground">No clients yet.</p>;

  const onGenerate = async (row: typeof data[number]) => {
    setGeneratingId(row.client_id);
    try {
      await generateClientPortfolioReport(row);
      toast({ title: "Client status report downloaded" });
    } catch (e) {
      toast({
        title: "Could not generate report",
        description: e instanceof Error ? e.message : String(e),
        variant: "destructive",
      });
    } finally {
      setGeneratingId(null);
    }
  };

  return (
    <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
      {data.map((c) => {
        const decided = c.won_count + c.lost_count + c.no_bid_count;
        const winRate = decided > 0 ? Math.round((c.won_count / decided) * 100) : null;
        return (
          <Card key={c.client_id}>
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center gap-2"><Briefcase className="h-4 w-4" /> {c.client_name ?? "Unnamed"}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              <div className="flex justify-between"><span className="text-muted-foreground">Active</span><span className="tabular-nums">{c.active_count} / {c.solicitation_count}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">Est. value</span><span className="tabular-nums">{fmtUsd(Number(c.total_est_value))}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">Win rate</span><span className="tabular-nums">{winRate == null ? "—" : `${winRate}%`}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">Awarded</span><span className="tabular-nums">{fmtUsd(Number(c.awarded_value_total))}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">Cost-to-bid</span><span className="tabular-nums">{fmtUsd(Number(c.cost_to_bid_total))}</span></div>
              <Button
                size="sm"
                variant="outline"
                className="w-full mt-2 gap-1.5"
                onClick={() => onGenerate(c)}
                disabled={generatingId === c.client_id}
              >
                <Download className="h-3.5 w-3.5" />
                {generatingId === c.client_id ? "Generating…" : "Status report"}
              </Button>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}

function DeliverablesTable({ clientId }: { clientId: string | null }) {
  const { data = [], isLoading } = useDeliverablesLibrary({ clientId });
  const navigate = useNavigate();
  if (isLoading) return <Skeleton className="h-48" />;
  if (data.length === 0) return <p className="text-sm text-muted-foreground">No reports have been generated yet. Open a solicitation to create one.</p>;
  return (
    <Card>
      <CardContent className="p-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Report</TableHead>
              <TableHead>Type</TableHead>
              <TableHead>Solicitation</TableHead>
              <TableHead>Client</TableHead>
              <TableHead>Created</TableHead>
              <TableHead></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.map((r) => (
              <TableRow key={r.id}>
                <TableCell className="font-medium flex items-center gap-2"><FileText className="h-3.5 w-3.5 text-muted-foreground" />{r.title}</TableCell>
                <TableCell><Badge variant="secondary">{r.report_type}</Badge></TableCell>
                <TableCell className="max-w-[200px] truncate">{r.solicitation?.title ?? "—"}</TableCell>
                <TableCell>{r.solicitation?.clients?.name ?? "—"}</TableCell>
                <TableCell className="text-muted-foreground text-xs tabular-nums">{r.created_at ? new Date(r.created_at).toLocaleDateString() : "—"}</TableCell>
                <TableCell className="text-right">
                  {r.solicitation?.id && (
                    <Button variant="ghost" size="sm" className="gap-1" onClick={() => navigate(`/solicitations/${r.solicitation!.id}?tab=reports`)}>
                      Open <ExternalLink className="h-3 w-3" />
                    </Button>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}

export default function Reports() {
  const [clientId, setClientId] = useState<string | null>(null);
  const { data: clients = [] } = useClientsList();

  return (
    <div className="flex flex-col h-full overflow-y-auto">
      <div className="border-b px-6 py-4 flex items-start justify-between gap-3 bg-background">
        <div>
          <h1 className="text-xl font-semibold">Reports</h1>
          <p className="text-sm text-muted-foreground">Operations, deliverables, and client portfolio.</p>
        </div>
        <div className="flex items-center gap-2">
          <Select value={clientId ?? "all"} onValueChange={(v) => setClientId(v === "all" ? null : v)}>
            <SelectTrigger className="w-[200px]"><SelectValue placeholder="All clients" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All clients</SelectItem>
              {clients.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
            </SelectContent>
          </Select>
          <PdfToolsMenu />
        </div>
      </div>

      <div className="flex-1 p-6">
        <Tabs defaultValue="operations" className="space-y-4">
          <TabsList>
            <TabsTrigger value="operations">Operations</TabsTrigger>
            <TabsTrigger value="deliverables">Deliverables</TabsTrigger>
            <TabsTrigger value="portfolio">Client portfolio</TabsTrigger>
            <TabsTrigger value="org">Org reports</TabsTrigger>
          </TabsList>

          <TabsContent value="operations" className="space-y-3">
            <div className="grid sm:grid-cols-2 lg:grid-cols-2 gap-3">
              <PipelineCard clientId={clientId} />
              <OnTimeCard clientId={clientId} />
              <WorkloadCard />
            </div>
          </TabsContent>

          <TabsContent value="deliverables">
            <DeliverablesTable clientId={clientId} />
          </TabsContent>

          <TabsContent value="portfolio">
            <PortfolioGrid />
          </TabsContent>

          <TabsContent value="org">
            <OrgReportsTab />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
