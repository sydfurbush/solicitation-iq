import { useMemo, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ExportMenu } from "@/features/exports/components/ExportMenu";
import { useOrgMembers } from "@/features/collaboration/hooks/useOrgMembers";
import { WritingQueueCard } from "@/features/writing-queue/components/WritingQueueCard";
import { useWritingQueue } from "@/features/writing-queue/hooks/useWritingQueue";
import { buildAssignmentsExport } from "@/features/writing-queue/lib/exportAssignments";

type ViewMode = "priority" | "owner" | "volume";

export default function SolicitationWritingQueue({
  solicitationId,
  solicitationTitle,
  clientName,
}: {
  solicitationId: string;
  currentPhase?: string;
  solicitationTitle?: string;
  clientName?: string;
}) {
  const { outline, rows, isLoading } = useWritingQueue(solicitationId);
  const { data: members = [] } = useOrgMembers();
  const [view, setView] = useState<ViewMode>("priority");

  const stats = useMemo(() => {
    const total = rows.length;
    const assigned = rows.filter((r) => r.node.assigned_to).length;
    const inProgress = rows.filter((r) => ["drafting", "pink_ready", "red_ready"].includes(r.node.writing_status ?? "")).length;
    const done = rows.filter((r) => r.node.writing_status === "final").length;
    const totalPages = rows.reduce((acc, r) => acc + (r.node.page_allocation ?? 0), 0);
    return { total, assigned, inProgress, done, totalPages, unassigned: total - assigned };
  }, [rows]);

  const sortedRows = useMemo(() => [...rows].sort((a, b) => b.priority.total - a.priority.total), [rows]);

  const grouped = useMemo(() => {
    if (view === "priority") return null;
    const g = new Map<string, typeof rows>();
    for (const r of sortedRows) {
      const key =
        view === "owner"
          ? (() => {
              const m = members.find((x) => x.id === r.node.assigned_to);
              return r.node.assigned_to ? (m?.full_name ?? m?.email ?? "Assigned") : "Unassigned";
            })()
          : r.node.volume || "Unassigned volume";
      const list = g.get(key) ?? [];
      list.push(r);
      g.set(key, list);
    }
    return [...g.entries()].sort(([a], [b]) =>
      a === "Unassigned" || a === "Unassigned volume" ? 1 : b === "Unassigned" || b === "Unassigned volume" ? -1 : a.localeCompare(b),
    );
  }, [view, sortedRows, members]);

  if (isLoading) {
    return <p className="text-sm text-muted-foreground">Loading writing queue…</p>;
  }

  if (!outline || rows.length === 0) {
    return (
      <Card>
        <CardContent className="py-12 text-center text-sm text-muted-foreground">
          Generate the proposal outline (Phase 3) first. The writing queue derives from outline sections,
          their linked requirements, and mapped win themes.
        </CardContent>
      </Card>
    );
  }

  return (
    <TooltipProvider delayDuration={150}>
      <div className="space-y-4">
        {/* Summary strip */}
        <Card>
          <CardContent className="p-4 flex flex-wrap items-center gap-3">
            <Stat label="Sections" value={stats.total} />
            <Stat label="Assigned" value={stats.assigned} />
            <Stat label="In progress" value={stats.inProgress} />
            <Stat label="Final" value={stats.done} tone="success" />
            <Stat label="Pages" value={stats.totalPages} />
            {stats.unassigned > 0 && (
              <Badge variant="outline" className="border-amber-500/40 text-amber-600">
                {stats.unassigned} unassigned
              </Badge>
            )}
            <div className="ml-auto">
              <ExportMenu
                build={() => buildAssignmentsExport({ rows: sortedRows, members, solicitationTitle, clientName })}
                disabled={rows.length === 0}
                label="Export assignments"
                solicitationId={solicitationId}
                kind="writing-queue"
              />
            </div>
          </CardContent>
        </Card>

        {/* View tabs */}
        <Tabs value={view} onValueChange={(v) => setView(v as ViewMode)}>
          <TabsList>
            <TabsTrigger value="priority">By priority</TabsTrigger>
            <TabsTrigger value="owner">By owner</TabsTrigger>
            <TabsTrigger value="volume">By volume</TabsTrigger>
          </TabsList>
        </Tabs>

        {/* List */}
        {view === "priority" && (
          <div className="space-y-2">
            {sortedRows.map((r) => (
              <WritingQueueCard key={r.node.id} row={r} outlineId={outline.id} />
            ))}
          </div>
        )}

        {view !== "priority" && grouped && (
          <div className="space-y-6">
            {grouped.map(([key, list]) => (
              <div key={key} className="space-y-2">
                <div className="flex items-center gap-2">
                  <h3 className="text-sm font-semibold">{key}</h3>
                  <Badge variant="secondary" className="text-[10px]">
                    {list.length}
                  </Badge>
                </div>
                <div className="space-y-2">
                  {list.map((r) => (
                    <WritingQueueCard key={r.node.id} row={r} outlineId={outline.id} />
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </TooltipProvider>
  );
}

function Stat({ label, value, tone }: { label: string; value: number; tone?: "success" }) {
  return (
    <div className="flex items-baseline gap-1.5">
      <span className={`text-lg font-semibold ${tone === "success" ? "text-emerald-600" : ""}`}>{value}</span>
      <span className="text-xs text-muted-foreground uppercase tracking-wide">{label}</span>
    </div>
  );
}
