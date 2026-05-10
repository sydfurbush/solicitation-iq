import { useEffect, useMemo } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { z } from "zod";
import { format, formatDistanceToNow, isAfter, isBefore, addDays } from "date-fns";
import {
  AlertTriangle,
  ArrowRight,
  Briefcase,
  FilterX,
  CalendarClock,
  FileText,
  Lightbulb,
  ListChecks,
  TrendingUp,
} from "lucide-react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useSolicitations, type SolicitationWithClient } from "@/features/solicitations/hooks/useSolicitations";
import { useClients } from "@/features/clients/hooks/useClients";

const STATUS_LABELS: Record<string, string> = {
  intake: "Intake",
  processing: "Processing",
  phase_1_complete: "Phase 1 Complete",
  phase_2_active: "Phase 2 Active",
  phase_3_active: "Phase 3 Active",
  phase_4_active: "Phase 4 Active",
  complete: "Complete",
  archived: "Archived",
};

const STATUS_KEYS = Object.keys(STATUS_LABELS);
const uuidSchema = z.string().uuid();

const STATUS_COLORS = [
  "hsl(var(--primary))",
  "hsl(var(--chart-2, 173 58% 39%))",
  "hsl(var(--chart-3, 43 74% 66%))",
  "hsl(var(--chart-4, 27 87% 67%))",
  "hsl(var(--chart-5, 280 65% 60%))",
  "hsl(var(--muted-foreground))",
  "hsl(var(--accent))",
];

function MetricCard({
  icon: Icon,
  label,
  value,
  hint,
}: {
  icon: React.ElementType;
  label: string;
  value: number | string;
  hint?: string;
}) {
  return (
    <Card>
      <CardContent className="p-6">
        <div className="flex items-start justify-between">
          <div className="space-y-1">
            <p className="text-sm text-muted-foreground">{label}</p>
            <p className="text-3xl font-bold tracking-tight">{value}</p>
            {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
          </div>
          <div className="rounded-lg bg-primary/10 p-3 text-primary">
            <Icon className="h-5 w-5" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function ListRowSkeleton() {
  return (
    <div className="flex items-center justify-between rounded-md border bg-card p-3">
      <div className="flex-1 space-y-2">
        <Skeleton className="h-4 w-3/4" />
        <Skeleton className="h-3 w-1/2" />
      </div>
      <Skeleton className="ml-3 h-5 w-16 shrink-0" />
    </div>
  );
}

function ListSkeleton({ rows = 5 }: { rows?: number }) {
  return (
    <div className="space-y-2">
      {Array.from({ length: rows }).map((_, i) => (
        <ListRowSkeleton key={i} />
      ))}
    </div>
  );
}

export default function Dashboard() {
  const { data: solicitations, isLoading, isFetching } = useSolicitations();
  const { data: clients } = useClients();
  const [searchParams, setSearchParams] = useSearchParams();

  const rawClient = searchParams.get("client");
  const rawStatus = searchParams.get("status");

  // Validate status against known keys; unknown -> "all"
  const statusFilter = rawStatus && STATUS_KEYS.includes(rawStatus) ? rawStatus : "all";

  // Validate client: must be a UUID and (once clients load) must exist
  const clientIsValidUuid = rawClient ? uuidSchema.safeParse(rawClient).success : false;
  const clientsLoaded = Array.isArray(clients);
  const clientExists =
    clientIsValidUuid && clientsLoaded ? clients!.some((c) => c.id === rawClient) : clientIsValidUuid;
  const clientFilter = clientExists ? rawClient! : "all";

  // Strip invalid params from the URL once we can confirm they're invalid
  useEffect(() => {
    const next = new URLSearchParams(searchParams);
    let changed = false;
    if (rawStatus && !STATUS_KEYS.includes(rawStatus)) {
      next.delete("status");
      changed = true;
    }
    if (rawClient && (!clientIsValidUuid || (clientsLoaded && !clientExists))) {
      next.delete("client");
      changed = true;
    }
    if (changed) setSearchParams(next, { replace: true });
  }, [rawStatus, rawClient, clientIsValidUuid, clientsLoaded, clientExists, searchParams, setSearchParams]);

  const updateFilter = (key: "client" | "status", value: string) => {
    const next = new URLSearchParams(searchParams);
    if (value === "all") next.delete(key);
    else next.set(key, value);
    setSearchParams(next, { replace: true });
  };
  const setClientFilter = (v: string) => updateFilter("client", v);
  const setStatusFilter = (v: string) => updateFilter("status", v);

  const stats = useMemo(() => {
    const list: SolicitationWithClient[] = solicitations ?? [];
    const now = new Date();
    const in14 = addDays(now, 14);

    const filtered = list.filter((s) => {
      if (clientFilter !== "all" && (s.client?.id ?? "unknown") !== clientFilter) return false;
      if (statusFilter !== "all" && (s.status ?? "intake") !== statusFilter) return false;
      return true;
    });

    const statusCounts = list.reduce<Record<string, number>>((acc, s) => {
      const k = s.status ?? "intake";
      acc[k] = (acc[k] ?? 0) + 1;
      return acc;
    }, {});

    const upcoming = filtered
      .filter((s) => s.proposal_due_date && isAfter(new Date(s.proposal_due_date), now))
      .sort(
        (a, b) =>
          new Date(a.proposal_due_date!).getTime() - new Date(b.proposal_due_date!).getTime()
      );

    const dueSoon = upcoming.filter(
      (s) => isBefore(new Date(s.proposal_due_date!), in14)
    );

    const overdue = filtered.filter(
      (s) =>
        s.proposal_due_date &&
        isBefore(new Date(s.proposal_due_date), now) &&
        s.status !== "complete" &&
        s.status !== "archived"
    );

    const recent = [...filtered]
      .sort((a, b) => new Date(b.created_at!).getTime() - new Date(a.created_at!).getTime())
      .slice(0, 6);

    const totalRisks = filtered.reduce((sum, s) => sum + (s.risks_count ?? 0), 0);
    const totalOpps = filtered.reduce((sum, s) => sum + (s.opportunities_count ?? 0), 0);
    const totalQuestions = filtered.reduce((sum, s) => sum + (s.questions_count ?? 0), 0);

    const statusChart = Object.entries(statusCounts).map(([k, v]) => ({
      name: STATUS_LABELS[k] ?? k,
      value: v,
    }));

    const byClient = list.reduce<Record<string, { name: string; count: number }>>((acc, s) => {
      const id = s.client?.id ?? "unknown";
      const name = s.client?.name ?? "Unassigned";
      if (!acc[id]) acc[id] = { name, count: 0 };
      acc[id].count += 1;
      return acc;
    }, {});
    const clientChart = Object.values(byClient)
      .sort((a, b) => b.count - a.count)
      .slice(0, 6);

    return {
      total: filtered.length,
      activeClients: clients?.length ?? 0,
      upcoming,
      dueSoon,
      overdue,
      recent,
      totalRisks,
      totalOpps,
      totalQuestions,
      statusChart,
      clientChart,
      isFiltered: clientFilter !== "all" || statusFilter !== "all",
    };
  }, [solicitations, clients, clientFilter, statusFilter]);

  if (isLoading) {
    return (
      <div className="space-y-6 p-6">
        <Skeleton className="h-10 w-64" />
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-28" />
          ))}
        </div>
        <div className="grid gap-4 lg:grid-cols-2">
          <Skeleton className="h-80" />
          <Skeleton className="h-80" />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
          <p className="text-muted-foreground">
            Pipeline overview, recent solicitations, and key intelligence at a glance.
          </p>
        </div>
        <Button asChild>
          <Link to="/solicitations/new">
            New Solicitation
            <ArrowRight className="ml-2 h-4 w-4" />
          </Link>
        </Button>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-sm text-muted-foreground">Filter:</span>
        <Select value={clientFilter} onValueChange={setClientFilter}>
          <SelectTrigger className="h-9 w-[200px]">
            <SelectValue placeholder="All clients" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All clients</SelectItem>
            {(clients ?? []).map((c) => (
              <SelectItem key={c.id} value={c.id}>
                {c.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="h-9 w-[200px]">
            <SelectValue placeholder="All statuses" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            {Object.entries(STATUS_LABELS).map(([k, label]) => (
              <SelectItem key={k} value={k}>
                {label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {stats.isFiltered && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setSearchParams({}, { replace: true })}
          >
            Clear
          </Button>
        )}
      </div>

      {/* Top metrics */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <MetricCard
          icon={FileText}
          label="Total Solicitations"
          value={stats.total}
          hint={`${stats.activeClients} client${stats.activeClients === 1 ? "" : "s"}`}
        />
        <MetricCard
          icon={CalendarClock}
          label="Due in 14 Days"
          value={stats.dueSoon.length}
          hint={stats.overdue.length ? `${stats.overdue.length} overdue` : "On track"}
        />
        <MetricCard
          icon={AlertTriangle}
          label="Open Risks"
          value={stats.totalRisks}
          hint={`${stats.totalQuestions} strategic questions`}
        />
        <MetricCard
          icon={Lightbulb}
          label="Opportunities"
          value={stats.totalOpps}
          hint="Across all active solicitations"
        />
      </div>

      {stats.total === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center gap-3 p-12 text-center">
            {stats.isFiltered ? (
              <>
                <FilterX className="h-10 w-10 text-muted-foreground" />
                <h3 className="text-lg font-semibold">No solicitations match these filters</h3>
                <p className="max-w-md text-sm text-muted-foreground">
                  Try changing or clearing the client and status filters to see more results.
                </p>
                <Button
                  variant="outline"
                  className="mt-2"
                  onClick={() => setSearchParams({}, { replace: true })}
                >
                  Clear filters
                </Button>
              </>
            ) : (
              <>
                <Briefcase className="h-10 w-10 text-muted-foreground" />
                <h3 className="text-lg font-semibold">No solicitations yet</h3>
                <p className="text-sm text-muted-foreground">
                  Create your first solicitation to start tracking analysis, risks, and opportunities.
                </p>
                <Button asChild className="mt-2">
                  <Link to="/solicitations/new">Create Solicitation</Link>
                </Button>
              </>
            )}
          </CardContent>
        </Card>
      ) : (
        <>
          {/* Charts */}
          <div className="grid gap-4 lg:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <TrendingUp className="h-4 w-4" /> Pipeline by Status
                </CardTitle>
                <CardDescription>Current distribution of solicitations</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={stats.statusChart}
                        dataKey="value"
                        nameKey="name"
                        innerRadius={50}
                        outerRadius={90}
                        paddingAngle={2}
                      >
                        {stats.statusChart.map((_, i) => (
                          <Cell key={i} fill={STATUS_COLORS[i % STATUS_COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip
                        contentStyle={{
                          background: "hsl(var(--popover))",
                          border: "1px solid hsl(var(--border))",
                          borderRadius: 8,
                          fontSize: 12,
                        }}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                <div className="mt-2 flex flex-wrap gap-2">
                  {stats.statusChart.map((s, i) => (
                    <div key={s.name} className="flex items-center gap-1.5 text-xs">
                      <span
                        className="h-2.5 w-2.5 rounded-sm"
                        style={{ background: STATUS_COLORS[i % STATUS_COLORS.length] }}
                      />
                      <span className="text-muted-foreground">{s.name}</span>
                      <span className="font-medium">{s.value}</span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Briefcase className="h-4 w-4" /> Top Clients
                </CardTitle>
                <CardDescription>Solicitations by client</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={stats.clientChart} layout="vertical" margin={{ left: 10 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                      <XAxis type="number" allowDecimals={false} fontSize={12} stroke="hsl(var(--muted-foreground))" />
                      <YAxis
                        type="category"
                        dataKey="name"
                        width={100}
                        fontSize={12}
                        stroke="hsl(var(--muted-foreground))"
                      />
                      <Tooltip
                        contentStyle={{
                          background: "hsl(var(--popover))",
                          border: "1px solid hsl(var(--border))",
                          borderRadius: 8,
                          fontSize: 12,
                        }}
                      />
                      <Bar dataKey="count" fill="hsl(var(--primary))" radius={[0, 6, 6, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Lists */}
          <div className="grid gap-4 lg:grid-cols-2">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <ListChecks className="h-4 w-4" /> Recent Solicitations
                  </CardTitle>
                  <CardDescription>Latest items added to your pipeline</CardDescription>
                </div>
                <Button asChild variant="ghost" size="sm">
                  <Link to="/solicitations">View all</Link>
                </Button>
              </CardHeader>
              <CardContent className="space-y-2">
                {isFetching && stats.recent.length === 0 ? (
                  <ListSkeleton rows={5} />
                ) : (
                  <></>
                )}
                {!isFetching &&
                {stats.recent.map((s) => (
                  <Link
                    key={s.id}
                    to={`/solicitations/${s.id}`}
                    className="flex items-center justify-between rounded-md border bg-card p-3 transition-colors hover:bg-accent"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">{s.title}</p>
                      <p className="truncate text-xs text-muted-foreground">
                        {s.client?.name ?? "Unassigned"} ·{" "}
                        {formatDistanceToNow(new Date(s.created_at!), { addSuffix: true })}
                      </p>
                    </div>
                    <Badge variant="secondary" className="ml-3 shrink-0">
                      {STATUS_LABELS[s.status ?? "intake"]}
                    </Badge>
                  </Link>
                ))}
                {stats.recent.length === 0 && (
                  <div className="flex flex-col items-center gap-2 py-8 text-center">
                    <ListChecks className="h-6 w-6 text-muted-foreground" />
                    <p className="text-sm text-muted-foreground">
                      {stats.isFiltered
                        ? "No solicitations match these filters."
                        : "No solicitations yet."}
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <CalendarClock className="h-4 w-4" /> Upcoming Deadlines
                  </CardTitle>
                  <CardDescription>Proposals due soonest</CardDescription>
                </div>
              </CardHeader>
              <CardContent className="space-y-2">
                {stats.upcoming.slice(0, 6).map((s) => {
                  const due = new Date(s.proposal_due_date!);
                  const soon = isBefore(due, addDays(new Date(), 14));
                  return (
                    <Link
                      key={s.id}
                      to={`/solicitations/${s.id}`}
                      className="flex items-center justify-between rounded-md border bg-card p-3 transition-colors hover:bg-accent"
                    >
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium">{s.title}</p>
                        <p className="truncate text-xs text-muted-foreground">
                          {s.client?.name ?? "Unassigned"}
                        </p>
                      </div>
                      <div className="ml-3 shrink-0 text-right">
                        <p className="text-sm font-medium">{format(due, "MMM d")}</p>
                        <p className={`text-xs ${soon ? "text-destructive" : "text-muted-foreground"}`}>
                          {formatDistanceToNow(due, { addSuffix: true })}
                        </p>
                      </div>
                    </Link>
                  );
                })}
                {stats.upcoming.length === 0 && (
                  <div className="flex flex-col items-center gap-2 py-8 text-center">
                    <CalendarClock className="h-6 w-6 text-muted-foreground" />
                    <p className="text-sm text-muted-foreground">
                      {stats.isFiltered
                        ? "No upcoming deadlines for these filters."
                        : "No upcoming deadlines."}
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </>
      )}
    </div>
  );
}
