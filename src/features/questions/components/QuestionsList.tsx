import { useMemo, useState } from "react";
import { ChevronDown, ChevronRight } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { QuestionCard } from "./QuestionCard";
import {
  CATEGORIES,
  CATEGORY_LABEL,
  RECOMMENDATIONS,
  RECOMMENDATION_LABEL,
  getCategoryColor,
  type QuestionRow,
  type QuestionCategory,
  type QuestionRecommendation,
} from "../utils/questionHelpers";

interface Props {
  questions: QuestionRow[];
  onSelect: (q: QuestionRow) => void;
  onUpdate: (id: string, updates: Partial<QuestionRow>) => void;
  onBulkUpdate: (ids: string[], updates: Partial<QuestionRow>) => void;
  onDelete: (id: string) => void;
  onExportSelected: (ids: string[]) => void;
}

export function QuestionsList({ questions, onSelect, onUpdate, onBulkUpdate, onDelete, onExportSelected }: Props) {
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const grouped = useMemo(() => {
    const map = new Map<QuestionCategory, QuestionRow[]>();
    CATEGORIES.forEach((c) => map.set(c, []));
    for (const q of questions) map.get(q.category)?.push(q);
    return map;
  }, [questions]);

  const toggle = (c: string) => setCollapsed((s) => ({ ...s, [c]: !s[c] }));

  const toggleSelect = (id: string, checked: boolean) => {
    setSelected((s) => {
      const next = new Set(s);
      if (checked) next.add(id); else next.delete(id);
      return next;
    });
  };

  const selectedIds = Array.from(selected);

  return (
    <div className="space-y-4">
      {selected.size > 0 && (
        <div className="sticky top-0 z-10 flex items-center gap-2 rounded-md border bg-background/95 backdrop-blur p-3">
          <span className="text-sm font-medium">{selected.size} selected</span>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm">Change category</Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent>
              {CATEGORIES.map((c) => (
                <DropdownMenuItem key={c} onClick={() => onBulkUpdate(selectedIds, { category: c as QuestionCategory })}>
                  {CATEGORY_LABEL[c]}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm">Change recommendation</Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent>
              {RECOMMENDATIONS.map((r) => (
                <DropdownMenuItem key={r} onClick={() => onBulkUpdate(selectedIds, { recommendation: r as QuestionRecommendation })}>
                  {RECOMMENDATION_LABEL[r]}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
          <Button variant="outline" size="sm" onClick={() => onExportSelected(selectedIds)}>
            Export
          </Button>
          <Button variant="ghost" size="sm" onClick={() => setSelected(new Set())}>Clear</Button>
        </div>
      )}

      {CATEGORIES.map((cat) => {
        const items = grouped.get(cat) ?? [];
        if (items.length === 0) return null;
        const isCollapsed = collapsed[cat];
        return (
          <section key={cat} className="space-y-2">
            <button
              type="button"
              onClick={() => toggle(cat)}
              className="flex w-full items-center gap-2 text-left"
            >
              {isCollapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
              <h3 className="text-sm font-semibold">{CATEGORY_LABEL[cat]}</h3>
              <Badge variant="outline" className={getCategoryColor(cat)}>{items.length}</Badge>
            </button>
            {!isCollapsed && (
              <div className="space-y-2 pl-6">
                {items.map((q) => (
                  <QuestionCard
                    key={q.id}
                    question={q}
                    selected={selected.has(q.id)}
                    onSelectChange={(c) => toggleSelect(q.id, c)}
                    onClick={() => onSelect(q)}
                    onUpdate={(updates) => onUpdate(q.id, updates)}
                    onDelete={() => onDelete(q.id)}
                  />
                ))}
              </div>
            )}
          </section>
        );
      })}

      {questions.length === 0 && (
        <p className="py-12 text-center text-sm text-muted-foreground">No questions match your filters.</p>
      )}
    </div>
  );
}
