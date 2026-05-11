import { useState } from "react";
import { ChevronDown, ChevronRight, CheckCircle2, AlertTriangle, XCircle, Ban, History } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

import { cn } from "@/lib/utils";
import { usePriorImportHistory, type PriorImportHistoryRow } from "../hooks/usePriorImportHistory";

type Props = {
  priorLinkId: string;
};

export function ImportHistoryList({ priorLinkId }: Props) {
  const { data, isLoading } = usePriorImportHistory(priorLinkId);
  const [expanded, setExpanded] = useState<string | null>(null);

  if (isLoading) return null;
  if (!data || data.length === 0) return null;

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <History className="h-4 w-4" />
          Import history
          <Badge variant="secondary" className="ml-1">{data.length}</Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-1">
        {data.map((row) => (
          <HistoryRow
            key={row.id}
            row={row}
            isOpen={expanded === row.id}
            onToggle={() => setExpanded(expanded === row.id ? null : row.id)}
          />
        ))}
      </CardContent>
    </Card>
  );
}

function HistoryRow({ row, isOpen, onToggle }: { row: PriorImportHistoryRow; isOpen: boolean; onToggle: () => void }) {
  const Icon =
    row.status === "success" ? CheckCircle2 :
    row.status === "partial" ? AlertTriangle :
    row.status === "cancelled" ? Ban :
    XCircle;
  const iconColor =
    row.status === "success" ? "text-emerald-600" :
    row.status === "partial" ? "text-amber-600" :
    row.status === "cancelled" ? "text-muted-foreground" :
    "text-destructive";

  const startedDate = new Date(row.started_at);
  const failed = Array.isArray(row.failed_attachments) ? row.failed_attachments : [];

  return (
    <div className="rounded-md border">
      <button
        type="button"
        onClick={onToggle}
        className="w-full flex items-center gap-3 p-3 text-left hover:bg-muted/40 transition-colors"
      >
        {isOpen ? <ChevronDown className="h-4 w-4 shrink-0" /> : <ChevronRight className="h-4 w-4 shrink-0" />}
        <Icon className={cn("h-4 w-4 shrink-0", iconColor)} />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 text-sm">
            <span className="font-medium capitalize">{row.action}</span>
            <Badge variant="outline" className="text-xs">{row.source}</Badge>
            <Badge
              variant={row.status === "success" ? "default" : row.status === "failed" ? "destructive" : "secondary"}
              className="text-xs capitalize"
            >
              {row.status}
            </Badge>
          </div>
          <p className="text-xs text-muted-foreground mt-0.5">
            {startedDate.toLocaleString()}
            {" • "}
            {row.imported_count}/{row.found_count} imported
            {row.failed_count > 0 && <span className="text-destructive"> • {row.failed_count} failed</span>}
          </p>
        </div>
      </button>

      {isOpen && (
        <div className="px-3 pb-3 pt-0 space-y-2 text-xs">
          <div className="grid grid-cols-3 gap-2 pl-7">
            <Stat label="Found" value={row.found_count} />
            <Stat label="Imported" value={row.imported_count} positive />
            <Stat label="Failed" value={row.failed_count} negative={row.failed_count > 0} />
          </div>
          {row.error_message && (
            <div className="pl-7 text-destructive">{row.error_message}</div>
          )}
          {failed.length > 0 && (
            <div className="pl-7">
              <p className="text-muted-foreground mb-1">Failed attachments:</p>
              <ul className="list-disc pl-4 space-y-0.5 max-h-32 overflow-auto">
                {failed.map((f, i) => (
                  <li key={i} className="truncate">
                    <span className="font-medium text-foreground">{f.fileName ?? f.href}</span>
                    {f.error ? <span className="text-muted-foreground"> — {f.error}</span> : null}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function Stat({ label, value, positive, negative }: { label: string; value: number; positive?: boolean; negative?: boolean }) {
  return (
    <div className="rounded-md border p-2">
      <p className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className={cn(
        "text-sm font-semibold",
        positive && value > 0 && "text-emerald-600",
        negative && "text-destructive",
      )}>
        {value}
      </p>
    </div>
  );
}
