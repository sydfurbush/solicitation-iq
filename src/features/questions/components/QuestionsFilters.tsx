import { Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  CATEGORIES,
  CATEGORY_LABEL,
  RECOMMENDATIONS,
  RECOMMENDATION_LABEL,
  type QuestionFilters,
  type QuestionCategory,
  type QuestionRecommendation,
  type PriorityLevel,
} from "../utils/questionHelpers";

interface Props {
  filters: QuestionFilters;
  onChange: (f: QuestionFilters) => void;
}

const PRIORITIES: PriorityLevel[] = ["high", "medium", "low"];

export function QuestionsFilters({ filters, onChange }: Props) {
  const toggle = <T extends string>(arr: T[] | undefined, v: T): T[] => {
    const set = new Set(arr ?? []);
    if (set.has(v)) set.delete(v); else set.add(v);
    return Array.from(set);
  };

  return (
    <div className="space-y-3 rounded-lg border bg-card p-4">
      <div className="flex items-center gap-2">
        <Search className="h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search questions..."
          value={filters.search ?? ""}
          onChange={(e) => onChange({ ...filters, search: e.target.value })}
          className="h-9"
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <div className="space-y-1">
          <Label className="text-xs">Submitted</Label>
          <Select value={filters.submitted ?? "all"} onValueChange={(v) => onChange({ ...filters, submitted: v as QuestionFilters["submitted"] })}>
            <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All</SelectItem>
              <SelectItem value="submitted">Submitted only</SelectItem>
              <SelectItem value="not_submitted">Not submitted</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Source</Label>
          <Select value={filters.source ?? "all"} onValueChange={(v) => onChange({ ...filters, source: v as QuestionFilters["source"] })}>
            <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All</SelectItem>
              <SelectItem value="ai">AI generated</SelectItem>
              <SelectItem value="manual">Manual</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1 flex items-end">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onChange({})}
            className="h-9 ml-auto"
          >
            Reset
          </Button>
        </div>
      </div>

      <ChipRow
        label="Category"
        options={CATEGORIES}
        labelMap={CATEGORY_LABEL}
        active={filters.categories}
        onToggle={(v) => onChange({ ...filters, categories: toggle<QuestionCategory>(filters.categories, v) })}
      />
      <ChipRow
        label="Recommendation"
        options={RECOMMENDATIONS}
        labelMap={RECOMMENDATION_LABEL}
        active={filters.recommendations}
        onToggle={(v) => onChange({ ...filters, recommendations: toggle<QuestionRecommendation>(filters.recommendations, v) })}
      />
      <ChipRow
        label="Priority"
        options={PRIORITIES}
        labelMap={{ high: "High", medium: "Medium", low: "Low" }}
        active={filters.priorities}
        onToggle={(v) => onChange({ ...filters, priorities: toggle<PriorityLevel>(filters.priorities, v) })}
      />
    </div>
  );
}

function ChipRow<T extends string>({
  label,
  options,
  labelMap,
  active,
  onToggle,
}: {
  label: string;
  options: T[];
  labelMap: Record<T, string>;
  active?: T[];
  onToggle: (v: T) => void;
}) {
  return (
    <div className="space-y-1">
      <Label className="text-xs">{label}</Label>
      <div className="flex flex-wrap gap-1.5">
        {options.map((opt) => {
          const isActive = active?.includes(opt);
          return (
            <Badge
              key={opt}
              variant={isActive ? "default" : "outline"}
              className="cursor-pointer"
              onClick={() => onToggle(opt)}
            >
              {labelMap[opt]}
            </Badge>
          );
        })}
      </div>
    </div>
  );
}
