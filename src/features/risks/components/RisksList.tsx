import { useMemo, useState } from "react";
import { ChevronDown } from "lucide-react";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { RiskCard } from "./RiskCard";
import {
  SEVERITY_DOT,
  SEVERITY_LABEL,
  SEVERITY_ORDER,
  type RiskSeverity,
} from "@/features/risks/utils/riskHelpers";
import type { RiskRow } from "@/features/risks/hooks/useRisks";

interface RisksListProps {
  risks: RiskRow[];
  onToggleMitigated?: (id: string, next: boolean) => void;
  onEdit?: (risk: RiskRow) => void;
  onDelete?: (risk: RiskRow) => void;
}

type StatusFilter = "all" | "open" | "mitigated";

export function RisksList({ risks, onToggleMitigated, onEdit, onDelete }: RisksListProps) {
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [severityFilter, setSeverityFilter] = useState<RiskSeverity | "all">("all");

  const filtered = useMemo(() => {
    return risks.filter((r) => {
      if (statusFilter === "open" && r.is_mitigated) return false;
      if (statusFilter === "mitigated" && !r.is_mitigated) return false;
      if (severityFilter !== "all" && r.severity !== severityFilter) return false;
      return true;
    });
  }, [risks, statusFilter, severityFilter]);

  const grouped = useMemo(() => {
    const map = new Map<RiskSeverity, RiskRow[]>();
    SEVERITY_ORDER.forEach((s) => map.set(s, []));
    filtered.forEach((r) => {
      const sev = (r.severity ?? "medium") as RiskSeverity;
      map.get(sev)!.push(r);
    });
    return map;
  }, [filtered]);

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 flex-wrap">
        <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as StatusFilter)}>
          <SelectTrigger className="w-[160px] h-9"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All status</SelectItem>
            <SelectItem value="open">Open</SelectItem>
            <SelectItem value="mitigated">Mitigated</SelectItem>
          </SelectContent>
        </Select>
        <Select value={severityFilter} onValueChange={(v) => setSeverityFilter(v as RiskSeverity | "all")}>
          <SelectTrigger className="w-[180px] h-9"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All severities</SelectItem>
            {SEVERITY_ORDER.map((s) => (
              <SelectItem key={s} value={s}>{SEVERITY_LABEL[s]}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <span className="text-xs text-muted-foreground ml-auto">
          {filtered.length} of {risks.length} risks
        </span>
      </div>

      {SEVERITY_ORDER.map((sev) => {
        const items = grouped.get(sev) ?? [];
        if (items.length === 0) return null;
        return (
          <Collapsible key={sev} defaultOpen={sev === "critical" || sev === "high"}>
            <CollapsibleTrigger asChild>
              <Button variant="ghost" className="w-full justify-between h-auto py-2 px-2">
                <div className="flex items-center gap-2">
                  <span className={cn("h-2.5 w-2.5 rounded-full", SEVERITY_DOT[sev])} />
                  <span className="font-medium">{SEVERITY_LABEL[sev]}</span>
                  <Badge variant="secondary">{items.length}</Badge>
                </div>
                <ChevronDown className="h-4 w-4 transition-transform data-[state=open]:rotate-180" />
              </Button>
            </CollapsibleTrigger>
            <CollapsibleContent className="space-y-3 mt-2">
              {items.map((r) => (
                <RiskCard
                  key={r.id}
                  risk={r}
                  onToggleMitigated={onToggleMitigated}
                  onEdit={onEdit}
                  onDelete={onDelete}
                />
              ))}
            </CollapsibleContent>
          </Collapsible>
        );
      })}
    </div>
  );
}
