import { useState } from "react";
import { format } from "date-fns";
import {
  CheckCircle2,
  Pencil,
  Trash2,
  Sparkles,
  Loader2,
  MessageCircleQuestion,
  ChevronDown,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { toast } from "@/hooks/use-toast";
import {
  SEVERITY_BADGE,
  SEVERITY_LABEL,
  STATUS_PILL_MITIGATED,
  STATUS_PILL_OPEN,
  STATUS_STRIPE_MITIGATED,
  STATUS_STRIPE_OPEN,
  type RiskSeverity,
} from "@/features/risks/utils/riskHelpers";
import { useUpdateRisk, type RiskRow } from "@/features/risks/hooks/useRisks";
import {
  useSuggestRiskMitigation,
  type SuggestedSource,
} from "@/features/risks/hooks/useSuggestRiskMitigation";
import { ConvertRiskToQuestionDialog } from "@/features/risks/components/ConvertRiskToQuestionDialog";

interface RiskCardProps {
  risk: RiskRow;
  onToggleMitigated?: (id: string, next: boolean) => void;
  onEdit?: (risk: RiskRow) => void;
  onDelete?: (risk: RiskRow) => void;
}

export function RiskCard({ risk, onToggleMitigated, onEdit, onDelete }: RiskCardProps) {
  const sev = (risk.severity ?? "medium") as RiskSeverity;
  const saved = risk.mitigation_strategy ?? "";
  const [strategy, setStrategy] = useState(saved);
  const [aiSuggested, setAiSuggested] = useState(false);
  const [sources, setSources] = useState<SuggestedSource[]>([]);
  const [convertOpen, setConvertOpen] = useState(false);
  const suggest = useSuggestRiskMitigation();
  const updateRisk = useUpdateRisk(risk.solicitation_id);
  const hasSaved = saved.trim().length > 0;
  const hasUnsaved = strategy !== saved;

  const handleSuggest = async () => {
    if (strategy.trim().length > 0) {
      const confirmed = window.confirm("Replace current mitigation notes with an AI suggestion?");
      if (!confirmed) return;
    }
    try {
      const result = await suggest.mutateAsync(risk.id);
      setStrategy(result.mitigation_strategy);
      setAiSuggested(true);
      setSources(result.used_sources ?? []);
      toast({
        title: "Mitigation drafted",
        description: result.knowledge_count
          ? `Used ${result.knowledge_count} client knowledge source${result.knowledge_count === 1 ? "" : "s"}. Review and save.`
          : "No client knowledge matched — review carefully before saving.",
      });
    } catch (e) {
      toast({
        title: "Suggestion failed",
        description: e instanceof Error ? e.message : String(e),
        variant: "destructive",
      });
    }
  };

  const handleSave = () => {
    updateRisk.mutate({ id: risk.id, updates: { mitigation_strategy: strategy } });
  };

  return (
    <Card className={cn(risk.is_mitigated ? STATUS_STRIPE_MITIGATED : STATUS_STRIPE_OPEN)}>
      <CardContent className="p-5 space-y-3">
        <div className="flex items-start justify-between gap-3">
          <div className="space-y-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <Badge className={cn("border capitalize", SEVERITY_BADGE[sev])}>
                {SEVERITY_LABEL[sev]}
              </Badge>
              <Badge
                variant="outline"
                className={cn(
                  "text-[10px] gap-1",
                  risk.is_mitigated ? STATUS_PILL_MITIGATED : STATUS_PILL_OPEN,
                )}
              >
                {risk.is_mitigated ? (
                  <>
                    <CheckCircle2 className="h-3 w-3" /> Mitigated
                  </>
                ) : (
                  <>
                    <span className="h-1.5 w-1.5 rounded-full bg-amber-500" /> Open
                  </>
                )}
              </Badge>
              {!risk.is_ai_generated && (
                <Badge variant="outline" className="text-[10px]">Manual</Badge>
              )}
              {aiSuggested && (
                <Badge variant="outline" className="text-[10px] gap-1">
                  <Sparkles className="h-3 w-3" /> AI suggested
                </Badge>
              )}
            </div>
            <h3 className="font-semibold leading-snug">{risk.title}</h3>
          </div>
          <div className="flex gap-1 shrink-0">
            {onEdit && (
              <Button size="icon" variant="ghost" onClick={() => onEdit(risk)}>
                <Pencil className="h-4 w-4" />
              </Button>
            )}
            {onDelete && (
              <Button size="icon" variant="ghost" onClick={() => onDelete(risk)}>
                <Trash2 className="h-4 w-4" />
              </Button>
            )}
          </div>
        </div>

        <p className="text-sm text-muted-foreground whitespace-pre-line">{risk.description}</p>

        {risk.source_citation && (
          <div className="text-xs">
            <span className="font-medium text-muted-foreground">Source: </span>
            <span className="text-primary">{risk.source_citation}</span>
          </div>
        )}
        {risk.source_quote && (
          <blockquote className="border-l-2 border-muted pl-3 text-sm italic text-muted-foreground">
            "{risk.source_quote}"
          </blockquote>
        )}

        <div className="rounded-md border bg-muted/30 p-3 space-y-2">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Mitigation
          </p>
          {risk.is_mitigated ? (
            <div className="flex items-center gap-2 text-sm text-green-600 dark:text-green-400">
              <CheckCircle2 className="h-4 w-4" />
              <span>
                Mitigated{" "}
                {risk.updated_at && (
                  <span className="text-muted-foreground">
                    on {format(new Date(risk.updated_at), "PP")}
                  </span>
                )}
              </span>
              {onToggleMitigated && (
                <Button
                  size="sm"
                  variant="ghost"
                  className="ml-auto"
                  onClick={() => onToggleMitigated(risk.id, false)}
                >
                  Reopen
                </Button>
              )}
            </div>
          ) : (
            <div className="space-y-2">
              <Textarea
                rows={3}
                value={strategy}
                onChange={(e) => {
                  setStrategy(e.target.value);
                  if (aiSuggested) setAiSuggested(false);
                }}
                placeholder="Mitigation notes…"
              />

              {sources.length > 0 && (
                <Collapsible>
                  <CollapsibleTrigger asChild>
                    <Button variant="ghost" size="sm" className="h-7 px-2 text-xs">
                      <ChevronDown className="h-3 w-3 mr-1" />
                      Sources used ({sources.length})
                    </Button>
                  </CollapsibleTrigger>
                  <CollapsibleContent className="space-y-1 pl-2 pt-1">
                    {sources.map((s, i) => (
                      <div key={i} className="text-xs">
                        <span className="font-medium">[{s.tag}] {s.document_title}</span>
                        {s.snippet && (
                          <p className="text-muted-foreground line-clamp-2">{s.snippet}</p>
                        )}
                      </div>
                    ))}
                  </CollapsibleContent>
                </Collapsible>
              )}

              <div className="flex flex-wrap justify-end gap-2">
                <Button size="sm" variant="outline" onClick={handleSuggest} disabled={suggest.isPending}>
                  {suggest.isPending
                    ? <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    : <Sparkles className="h-4 w-4 mr-2" />}
                  {strategy.trim() ? "Suggest again" : "Suggest mitigation"}
                </Button>
                <Button size="sm" variant="outline" onClick={() => setConvertOpen(true)}>
                  <MessageCircleQuestion className="h-4 w-4 mr-2" /> Ask the agency
                </Button>
                <Button size="sm" variant="outline" onClick={handleSave} disabled={!hasUnsaved}>
                  Save notes
                </Button>
                {onToggleMitigated && (
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <span>
                          <Button
                            size="sm"
                            onClick={() => onToggleMitigated(risk.id, true)}
                            disabled={!hasSaved || hasUnsaved}
                          >
                            <CheckCircle2 className="h-4 w-4 mr-2" /> Mark mitigated
                          </Button>
                        </span>
                      </TooltipTrigger>
                      {(!hasSaved || hasUnsaved) && (
                        <TooltipContent>
                          {!hasSaved
                            ? "Add and save mitigation notes before marking mitigated."
                            : "Save your changes first."}
                        </TooltipContent>
                      )}
                    </Tooltip>
                  </TooltipProvider>
                )}
              </div>
            </div>
          )}
        </div>

        <ConvertRiskToQuestionDialog
          open={convertOpen}
          onOpenChange={setConvertOpen}
          risk={risk}
          solicitationId={risk.solicitation_id}
        />
      </CardContent>
    </Card>
  );
}
