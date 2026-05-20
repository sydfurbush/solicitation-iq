import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { CheckCircle2, Sparkles, Loader2, MessageCircleQuestion, ChevronDown, Check } from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/utils";
import { toast } from "@/hooks/use-toast";
import {
  SEVERITY_BADGE,
  SEVERITY_LABEL,
  STATUS_PILL_OPEN,
  STATUS_STRIPE_OPEN,
  type RiskSeverity,
} from "@/features/risks/utils/riskHelpers";
import {
  useUpdateRisk,
  useMarkRiskMitigated,
  type RiskRow,
} from "@/features/risks/hooks/useRisks";
import {
  useSuggestRiskMitigation,
  type SuggestedSource,
} from "@/features/risks/hooks/useSuggestRiskMitigation";
import { ConvertRiskToQuestionDialog } from "@/features/risks/components/ConvertRiskToQuestionDialog";

interface Props {
  solicitationId: string;
  risks: RiskRow[];
}

export function RiskMitigationTracker({ solicitationId, risks }: Props) {
  const updateRisk = useUpdateRisk(solicitationId);
  const markMitigated = useMarkRiskMitigated(solicitationId);
  const total = risks.length;
  const mitigated = risks.filter((r) => r.is_mitigated).length;
  const open = risks.filter((r) => !r.is_mitigated);
  const pct = total ? Math.round((mitigated / total) * 100) : 0;

  return (
    <Card>
      <CardContent className="p-5 space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="font-semibold">Risk mitigation</h3>
            <p className="text-xs text-muted-foreground">
              {mitigated} of {total} risks mitigated
            </p>
          </div>
          <span className="text-2xl font-bold">{pct}%</span>
        </div>
        <Progress value={pct} className="h-2" />

        {open.length === 0 ? (
          <p className="text-sm text-center text-muted-foreground py-6">
            All risks have been mitigated.
          </p>
        ) : (
          <div className="space-y-3">
            {open.map((r) => (
              <UnmitigatedRow
                key={r.id}
                risk={r}
                solicitationId={solicitationId}
                onSaveStrategy={(strategy) =>
                  updateRisk.mutate({ id: r.id, updates: { mitigation_strategy: strategy } })
                }
                onMarkMitigated={async (strategy) => {
                  const trimmed = strategy.trim();
                  if (trimmed && trimmed !== (r.mitigation_strategy ?? "")) {
                    await updateRisk.mutateAsync({
                      id: r.id,
                      updates: { mitigation_strategy: trimmed },
                    });
                  }
                  await markMitigated.mutateAsync({ id: r.id, isMitigated: true });
                }}
              />
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function UnmitigatedRow({
  risk,
  solicitationId,
  onSaveStrategy,
  onMarkMitigated,
}: {
  risk: RiskRow;
  solicitationId: string;
  onSaveStrategy: (s: string) => void;
  onMarkMitigated: (s: string) => void | Promise<void>;
}) {
  const saved = risk.mitigation_strategy ?? "";
  const [strategy, setStrategy] = useState(saved);
  const [aiSuggested, setAiSuggested] = useState(false);
  const [sources, setSources] = useState<SuggestedSource[]>([]);
  const [convertOpen, setConvertOpen] = useState(false);
  const suggest = useSuggestRiskMitigation();
  const sev = (risk.severity ?? "medium") as RiskSeverity;

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

  return (
    <div className={cn("rounded-md border p-3 space-y-2", STATUS_STRIPE_OPEN)}>
      <div className="flex items-start justify-between gap-2">
        <div className="space-y-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <Badge className={cn("border", SEVERITY_BADGE[sev])}>{SEVERITY_LABEL[sev]}</Badge>
            <Badge variant="outline" className={cn("text-[10px] gap-1", STATUS_PILL_OPEN)}>
              <span className="h-1.5 w-1.5 rounded-full bg-amber-500" /> Open
            </Badge>
            {aiSuggested && (
              <Badge variant="outline" className="text-[10px] gap-1">
                <Sparkles className="h-3 w-3" /> AI suggested
              </Badge>
            )}
          </div>
          <p className="font-medium text-sm">{risk.title}</p>
        </div>
      </div>
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

      <div className="flex justify-end gap-2 flex-wrap">
        <Button
          size="sm"
          variant={aiSuggested ? "secondary" : "outline"}
          onClick={handleSuggest}
          disabled={suggest.isPending || aiSuggested}
        >
          {suggest.isPending ? (
            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
          ) : aiSuggested ? (
            <Check className="h-4 w-4 mr-2" />
          ) : (
            <Sparkles className="h-4 w-4 mr-2" />
          )}
          {aiSuggested
            ? "Suggestion applied"
            : strategy.trim()
              ? "Suggest again"
              : "Suggest mitigation"}
        </Button>
        <Button
          size="sm"
          variant="outline"
          onClick={() => setConvertOpen(true)}
        >
          <MessageCircleQuestion className="h-4 w-4 mr-2" /> Ask the agency
        </Button>
        <Button
          size="sm"
          variant="outline"
          onClick={() => onSaveStrategy(strategy)}
          disabled={!hasUnsaved}
        >
          Save notes
        </Button>
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <span>
                <Button
                  size="sm"
                  onClick={() => onMarkMitigated(strategy)}
                  disabled={strategy.trim().length === 0}
                >
                  <CheckCircle2 className="h-4 w-4 mr-2" /> Mark mitigated
                </Button>
              </span>
            </TooltipTrigger>
            {strategy.trim().length === 0 && (
              <TooltipContent>
                Add mitigation notes before marking mitigated.
              </TooltipContent>
            )}
          </Tooltip>
        </TooltipProvider>
      </div>

      <ConvertRiskToQuestionDialog
        open={convertOpen}
        onOpenChange={setConvertOpen}
        risk={risk}
        solicitationId={solicitationId}
      />
    </div>
  );
}
