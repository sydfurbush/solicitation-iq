import { useMemo } from "react";
import { cn } from "@/lib/utils";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { STATUS_LABEL, type DraftStatus } from "../utils/draftStatus";

type NodeLite = {
  id: string;
  volume: string | null;
  page_allocation: number | null;
};

type DraftLite = {
  outline_node_id: string;
  word_count: number | null;
};

interface Props {
  nodes: NodeLite[];
  drafts: DraftLite[];
  statuses: Map<string, DraftStatus>;
  filter: DraftStatus | null;
  onFilterChange: (status: DraftStatus | null) => void;
}

const WORDS_PER_PAGE = 350;

export function Phase5ProgressHeader({ nodes, drafts, statuses, filter, onFilterChange }: Props) {
  const total = nodes.length;
  const counts = useMemo(() => {
    const c: Record<DraftStatus, number> = { none: 0, ai: 0, edited: 0, polished: 0 };
    for (const n of nodes) {
      const s = statuses.get(n.id) ?? "none";
      c[s] += 1;
    }
    return c;
  }, [nodes, statuses]);
  const drafted = total - counts.none;
  const draftMap = useMemo(() => new Map(drafts.map((d) => [d.outline_node_id, d.word_count ?? 0])), [drafts]);

  const volumes = useMemo(() => {
    const map = new Map<string, { words: number; budget: number }>();
    for (const n of nodes) {
      const vol = n.volume ?? "Unassigned";
      const cur = map.get(vol) ?? { words: 0, budget: 0 };
      cur.words += draftMap.get(n.id) ?? 0;
      cur.budget += (n.page_allocation ?? 0) * WORDS_PER_PAGE;
      map.set(vol, cur);
    }
    return Array.from(map.entries()).sort((a, b) => a[0].localeCompare(b[0]));
  }, [nodes, draftMap]);

  const draftedPct = total > 0 ? Math.round((drafted / total) * 100) : 0;

  const chips: Array<{ status: DraftStatus; count: number }> = [
    { status: "none", count: counts.none },
    { status: "ai", count: counts.ai },
    { status: "edited", count: counts.edited },
    { status: "polished", count: counts.polished },
  ];

  return (
    <div className="border rounded-md p-3 bg-card space-y-3">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="min-w-0">
          <div className="text-xs text-muted-foreground">Drafting progress</div>
          <div className="text-sm font-semibold">
            {drafted} of {total} sections drafted ({draftedPct}%)
          </div>
        </div>
        <div className="flex items-center gap-1.5 flex-wrap">
          {chips.map(({ status, count }) => {
            const active = filter === status;
            return (
              <button
                key={status}
                type="button"
                onClick={() => onFilterChange(active ? null : status)}
                className={cn(
                  "inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-[11px] transition-colors",
                  active ? "bg-foreground text-background border-foreground" : "bg-background hover:bg-muted",
                )}
                aria-pressed={active}
              >
                <span
                  className="inline-block h-2 w-2 rounded-full"
                  style={{ backgroundColor: `hsl(var(--status-${status}))` }}
                />
                {STATUS_LABEL[status]} <span className="font-semibold">{count}</span>
              </button>
            );
          })}
          {filter && (
            <button
              type="button"
              onClick={() => onFilterChange(null)}
              className="text-[11px] text-muted-foreground underline hover:text-foreground"
            >
              clear filter
            </button>
          )}
        </div>
      </div>
      <Progress value={draftedPct} className="h-1.5" />
      {volumes.length > 0 && (
        <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
          {volumes.map(([vol, { words, budget }]) => {
            const pct = budget > 0 ? Math.min(100, Math.round((words / budget) * 100)) : 0;
            const over = budget > 0 && words > budget;
            return (
              <div key={vol} className="text-[11px] space-y-1">
                <div className="flex items-center justify-between gap-2">
                  <span className="truncate font-medium">{vol}</span>
                  <Badge variant="outline" className={cn("text-[10px] py-0 px-1", over && "border-destructive text-destructive")}>
                    {words.toLocaleString()}w{budget > 0 ? ` / ${budget.toLocaleString()}w` : ""}
                  </Badge>
                </div>
                {budget > 0 && (
                  <div className="h-1 rounded-full bg-muted overflow-hidden">
                    <div
                      className={cn("h-full transition-all", over ? "bg-destructive" : "bg-primary")}
                      style={{ width: `${over ? 100 : pct}%` }}
                    />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
