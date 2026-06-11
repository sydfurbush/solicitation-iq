import { useState } from "react";
import { AlertTriangle, ChevronDown, ChevronUp, MessageSquare } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useRisks, type RiskRow } from "@/features/risks/hooks/useRisks";

type Props = {
  solicitationId: string;
  onDiscuss: (prompt: string) => void;
  compact?: boolean;
};

const SEVERITY_RANK: Record<string, number> = { critical: 0, high: 1, medium: 2, low: 3 };

export function RiskRadar({ solicitationId, onDiscuss, compact }: Props) {
  const { data: all = [] } = useRisks(solicitationId);
  const [open, setOpen] = useState(!compact);

  const open_risks = all
    .filter((r) => !r.is_mitigated && (r.severity === "critical" || r.severity === "high"))
    .sort((a, b) => (SEVERITY_RANK[a.severity] ?? 9) - (SEVERITY_RANK[b.severity] ?? 9));

  if (open_risks.length === 0) return null;

  return (
    <div className="rounded-md border border-destructive/30 bg-destructive/5">
      <button
        type="button"
        className="w-full flex items-center gap-2 px-3 py-2 text-sm font-medium"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
      >
        <AlertTriangle className="h-4 w-4 text-destructive" />
        <span>Risk Radar</span>
        <Badge variant="destructive" className="h-5 px-1.5 text-[10px]">
          {open_risks.length}
        </Badge>
        <span className="ml-auto text-muted-foreground">
          {open ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
        </span>
      </button>
      {open && (
        <ul className="px-3 pb-3 space-y-2 max-h-64 overflow-y-auto">
          {open_risks.slice(0, 8).map((r) => (
            <RiskRow key={r.id} r={r} onDiscuss={onDiscuss} />
          ))}
        </ul>
      )}
    </div>
  );
}

function RiskRow({ r, onDiscuss }: { r: RiskRow; onDiscuss: (p: string) => void }) {
  const variant = r.severity === "critical" ? "destructive" : "secondary";
  return (
    <li className="rounded border border-border/60 bg-background p-2">
      <div className="flex items-start gap-2">
        <Badge variant={variant as any} className="text-[10px] uppercase shrink-0">
          {r.severity}
        </Badge>
        <div className="flex-1 min-w-0">
          <div className="text-sm font-medium truncate">{r.title}</div>
          {r.description && (
            <div className="text-xs text-muted-foreground line-clamp-2">{r.description}</div>
          )}
        </div>
        <Button
          type="button"
          size="sm"
          variant="ghost"
          className="h-7 px-2 text-xs gap-1 shrink-0"
          onClick={() =>
            onDiscuss(
              `How should we mitigate this ${r.severity} risk: **${r.title}**?${
                r.description ? `\n\nContext: ${r.description.slice(0, 400)}` : ""
              }`,
            )
          }
        >
          <MessageSquare className="h-3 w-3" /> Discuss
        </Button>
      </div>
    </li>
  );
}
