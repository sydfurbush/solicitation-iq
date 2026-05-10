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
import { OpportunityCard } from "./OpportunityCard";
import {
  OPPORTUNITY_LABEL,
  impactLevel,
  type OpportunityType,
} from "@/features/risks/utils/riskHelpers";
import { OPPORTUNITY_TYPES } from "@/lib/validators/riskOpportunity";
import type { OpportunityRow } from "@/features/opportunities/hooks/useOpportunities";

interface Props {
  opportunities: OpportunityRow[];
  onEdit?: (o: OpportunityRow) => void;
  onDelete?: (o: OpportunityRow) => void;
}

type ImpactFilter = "all" | "high" | "medium" | "low";

export function OpportunitiesList({ opportunities, onEdit, onDelete }: Props) {
  const [typeFilter, setTypeFilter] = useState<OpportunityType | "all">("all");
  const [impactFilter, setImpactFilter] = useState<ImpactFilter>("all");

  const filtered = useMemo(() => {
    return opportunities.filter((o) => {
      if (typeFilter !== "all" && o.opportunity_type !== typeFilter) return false;
      if (impactFilter !== "all" && impactLevel(o.impact_score) !== impactFilter) return false;
      return true;
    });
  }, [opportunities, typeFilter, impactFilter]);

  const grouped = useMemo(() => {
    const map = new Map<OpportunityType, OpportunityRow[]>();
    OPPORTUNITY_TYPES.forEach((t) => map.set(t, []));
    [...filtered]
      .sort((a, b) => (b.impact_score ?? 0) - (a.impact_score ?? 0))
      .forEach((o) => {
        map.get(o.opportunity_type as OpportunityType)!.push(o);
      });
    return map;
  }, [filtered]);

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 flex-wrap">
        <Select value={typeFilter} onValueChange={(v) => setTypeFilter(v as OpportunityType | "all")}>
          <SelectTrigger className="w-[200px] h-9"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All types</SelectItem>
            {OPPORTUNITY_TYPES.map((t) => (
              <SelectItem key={t} value={t}>{OPPORTUNITY_LABEL[t]}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={impactFilter} onValueChange={(v) => setImpactFilter(v as ImpactFilter)}>
          <SelectTrigger className="w-[160px] h-9"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All impact</SelectItem>
            <SelectItem value="high">High (70+)</SelectItem>
            <SelectItem value="medium">Medium (40-69)</SelectItem>
            <SelectItem value="low">Low (&lt;40)</SelectItem>
          </SelectContent>
        </Select>
        <span className="text-xs text-muted-foreground ml-auto">
          {filtered.length} of {opportunities.length} opportunities
        </span>
      </div>

      {OPPORTUNITY_TYPES.map((t) => {
        const items = grouped.get(t) ?? [];
        if (items.length === 0) return null;
        return (
          <Collapsible key={t} defaultOpen>
            <CollapsibleTrigger asChild>
              <Button variant="ghost" className="w-full justify-between h-auto py-2 px-2">
                <div className="flex items-center gap-2">
                  <span className="font-medium">{OPPORTUNITY_LABEL[t]}</span>
                  <Badge variant="secondary">{items.length}</Badge>
                </div>
                <ChevronDown className="h-4 w-4 transition-transform data-[state=open]:rotate-180" />
              </Button>
            </CollapsibleTrigger>
            <CollapsibleContent className="space-y-3 mt-2">
              {items.map((o) => (
                <OpportunityCard key={o.id} opportunity={o} onEdit={onEdit} onDelete={onDelete} />
              ))}
            </CollapsibleContent>
          </Collapsible>
        );
      })}
    </div>
  );
}
