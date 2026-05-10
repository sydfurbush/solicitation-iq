import { useState } from "react";
import { Check, ChevronDown, ChevronUp, MoreVertical, Quote, Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { CitationLink } from "@/features/analysis/components/CitationLink";
import {
  CATEGORIES,
  CATEGORY_LABEL,
  RECOMMENDATIONS,
  RECOMMENDATION_LABEL,
  getCategoryColor,
  getPriorityLevel,
  getRecommendationColor,
  type QuestionRow,
  type QuestionCategory,
  type QuestionRecommendation,
} from "../utils/questionHelpers";

interface Props {
  question: QuestionRow;
  selected?: boolean;
  onSelectChange?: (checked: boolean) => void;
  onClick?: () => void;
  onUpdate: (updates: Partial<QuestionRow>) => void;
  onDelete: () => void;
}

export function QuestionCard({ question, selected, onSelectChange, onClick, onUpdate, onDelete }: Props) {
  const [expanded, setExpanded] = useState(false);
  const priority = getPriorityLevel(question.priority);
  const rec = (question.recommendation ?? "monitor") as QuestionRecommendation;

  const stop = (e: React.MouseEvent) => e.stopPropagation();

  return (
    <div
      className={cn(
        "rounded-lg border bg-card p-4 transition hover:border-primary/40 cursor-pointer",
        selected && "ring-2 ring-primary/40"
      )}
      onClick={onClick}
    >
      <div className="flex items-start gap-3">
        {onSelectChange && (
          <div onClick={stop} className="pt-1">
            <Checkbox checked={selected} onCheckedChange={(c) => onSelectChange(c === true)} />
          </div>
        )}
        <div className="flex-1 min-w-0 space-y-2">
          <div className="flex flex-wrap items-center gap-1.5">
            <Badge variant="outline" className={getCategoryColor(question.category)}>
              {CATEGORY_LABEL[question.category]}
            </Badge>
            <Badge variant="outline" className={getRecommendationColor(rec)}>
              {RECOMMENDATION_LABEL[rec]}
            </Badge>
            <Badge variant="secondary" className="text-[10px] uppercase">{priority}</Badge>
            {question.is_submitted && (
              <Badge variant="default" className="bg-emerald-600 hover:bg-emerald-600">
                <Check className="h-3 w-3 mr-1" /> Submitted
              </Badge>
            )}
            {!question.is_ai_generated && (
              <Badge variant="outline" className="text-[10px]">Manual</Badge>
            )}
            <span className="ml-auto text-[10px] text-muted-foreground tabular-nums">P{question.priority ?? 0}</span>
          </div>

          <p className="text-sm font-medium leading-relaxed">{question.question_text}</p>

          {question.question_rationale && (
            <div>
              <button
                type="button"
                onClick={(e) => { stop(e); setExpanded((v) => !v); }}
                className="text-xs text-muted-foreground hover:text-foreground inline-flex items-center gap-1"
              >
                {expanded ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                Rationale
              </button>
              {expanded && (
                <p className="mt-1 text-xs text-muted-foreground whitespace-pre-wrap">{question.question_rationale}</p>
              )}
            </div>
          )}

          {question.source_quote && (
            <blockquote className="border-l-2 border-primary/40 pl-3 text-xs italic text-muted-foreground">
              <Quote className="inline h-3 w-3 mr-1" />
              {question.source_quote}
            </blockquote>
          )}

          <div className="flex items-center justify-between gap-2">
            <CitationLink section={question.source_citation ?? undefined} />
            <div onClick={stop}>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon" className="h-7 w-7">
                    <MoreVertical className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuLabel>Actions</DropdownMenuLabel>
                  <DropdownMenuItem
                    onClick={() => onUpdate({
                      is_submitted: !question.is_submitted,
                      submitted_at: !question.is_submitted ? new Date().toISOString() : null,
                    })}
                  >
                    {question.is_submitted ? "Mark as not submitted" : "Mark as submitted"}
                  </DropdownMenuItem>
                  <DropdownMenuSub>
                    <DropdownMenuSubTrigger>Change category</DropdownMenuSubTrigger>
                    <DropdownMenuSubContent>
                      {CATEGORIES.map((c) => (
                        <DropdownMenuItem key={c} onClick={() => onUpdate({ category: c as QuestionCategory })}>
                          {CATEGORY_LABEL[c]}
                        </DropdownMenuItem>
                      ))}
                    </DropdownMenuSubContent>
                  </DropdownMenuSub>
                  <DropdownMenuSub>
                    <DropdownMenuSubTrigger>Change recommendation</DropdownMenuSubTrigger>
                    <DropdownMenuSubContent>
                      {RECOMMENDATIONS.map((r) => (
                        <DropdownMenuItem key={r} onClick={() => onUpdate({ recommendation: r })}>
                          {RECOMMENDATION_LABEL[r]}
                        </DropdownMenuItem>
                      ))}
                    </DropdownMenuSubContent>
                  </DropdownMenuSub>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem className="text-destructive" onClick={onDelete}>
                    <Trash2 className="h-4 w-4 mr-2" /> Delete
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
