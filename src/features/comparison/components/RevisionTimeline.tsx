import { format } from "date-fns";
import { FileText, Plus } from "lucide-react";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { Revision } from "../hooks/useRevisions";

type Props = {
  revisions: Revision[];
  selectedAId: string | null;
  selectedBId: string | null;
  onSelect: (id: string) => void;
  onAddRevision?: () => void;
  docCounts?: Record<string, number>;
};

const KIND_TONE: Record<Revision["kind"], string> = {
  pre_sol: "bg-blue-500/15 text-blue-700 border-blue-500/30",
  amendment: "bg-amber-500/15 text-amber-700 border-amber-500/30",
  final: "bg-emerald-500/15 text-emerald-700 border-emerald-500/30",
  draft: "bg-muted text-muted-foreground border-border",
  other: "bg-muted text-muted-foreground border-border",
};

export function RevisionTimeline({ revisions, selectedAId, selectedBId, onSelect, onAddRevision, docCounts = {} }: Props) {
  return (
    <div className="rounded-lg border bg-card p-3">
      <div className="flex items-center justify-between mb-2">
        <p className="text-sm font-medium">Revision timeline</p>
        {onAddRevision && (
          <Button size="sm" variant="ghost" onClick={onAddRevision} className="h-7">
            <Plus className="h-3.5 w-3.5 mr-1" /> Add revision
          </Button>
        )}
      </div>
      <div className="flex items-stretch gap-2 overflow-x-auto pb-1">
        {revisions.map((r, i) => {
          const isA = r.id === selectedAId;
          const isB = r.id === selectedBId;
          return (
            <div key={r.id} className="flex items-stretch">
              <button
                type="button"
                onClick={() => onSelect(r.id)}
                className={cn(
                  "min-w-[180px] text-left rounded-md border px-3 py-2 transition hover:border-primary/40",
                  (isA || isB) && "ring-2 ring-primary/40 border-primary/40",
                )}
              >
                <div className="flex items-center gap-2 mb-1">
                  <Badge variant="outline" className={cn("capitalize", KIND_TONE[r.kind])}>
                    {r.kind.replace("_", "-")}
                  </Badge>
                  {isA && <Badge variant="secondary" className="text-[10px]">A</Badge>}
                  {isB && <Badge variant="secondary" className="text-[10px]">B</Badge>}
                </div>
                <p className="text-sm font-medium truncate">{r.label}</p>
                <p className="text-xs text-muted-foreground">{format(new Date(r.received_at), "MMM d, yyyy")}</p>
                <p className="text-xs text-muted-foreground flex items-center gap-1 mt-1">
                  <FileText className="h-3 w-3" />
                  {docCounts[r.id] ?? 0} doc{(docCounts[r.id] ?? 0) === 1 ? "" : "s"}
                </p>
              </button>
              {i < revisions.length - 1 && (
                <div className="flex items-center px-1 text-muted-foreground">→</div>
              )}
            </div>
          );
        })}
        {revisions.length === 0 && (
          <p className="text-sm text-muted-foreground italic px-2 py-3">No revisions yet.</p>
        )}
      </div>
    </div>
  );
}
