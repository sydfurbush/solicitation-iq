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
import { CheckCircle2, Sparkles, Loader2, Send, ChevronDown, Check, RotateCcw, Clock, X } from "lucide-react";
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
import { useUser } from "@/features/auth/hooks/useUser";

interface Props {
  solicitationId: string;
  risks: RiskRow[];
}

export function RiskMitigationTracker({ solicitationId, risks }: Props) {
  const updateRisk = useUpdateRisk(solicitationId);
  const markMitigated = useMarkRiskMitigated(solicitationId);
  const total = risks.length;
  const open = risks.filter((r) => !r.is_mitigated);
  const mitigatedList = risks.filter((r) => r.is_mitigated);
  const mitigated = mitigatedList.length;
  const pct = total ? Math.round((mitigated / total) * 100) : 0;

  const handleReopen = async (r: RiskRow) => {
    const ok = window.confirm("Reopen this risk? It will move back to Open.");
    if (!ok) return;
    try {
      await markMitigated.mutateAsync({ id: r.id, isMitigated: false });
      toast({ title: "Risk reopened", description: r.title });
    } catch (e) {
      toast({
        title: "Could not reopen risk",
        description: e instanceof Error ? e.message : String(e),
        variant: "destructive",
      });
    }
  };

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

        {total === 0 ? (
          <p className="text-sm text-center text-muted-foreground py-6">
            No risks yet.
          </p>
        ) : (
          <div className="space-y-4">
            {open.length > 0 && (
              <div className="space-y-3">
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                  Open ({open.length})
                </p>
                {open.map((r) => (
                  <UnmitigatedRow
                    key={r.id}
                    risk={r}
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

            {mitigatedList.length > 0 && (
              <div className="space-y-3">
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                  Mitigated ({mitigatedList.length})
                </p>
                {mitigatedList.map((r) => (
                  <MitigatedRow
                    key={r.id}
                    risk={r}
                    onReopen={() => handleReopen(r)}
                    isReopening={markMitigated.isPending}
                  />
                ))}
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function MitigatedRow({
  risk,
  onReopen,
  isReopening,
}: {
  risk: RiskRow;
  onReopen: () => void;
  isReopening: boolean;
}) {
  const sev = (risk.severity ?? "medium") as RiskSeverity;
  const notes = risk.mitigation_strategy ?? "";
  const byClient = (risk as any).sent_to_client === true;
  return (
    <div className="rounded-md border p-3 space-y-2 bg-emerald-500/5 border-emerald-500/30">
      <div className="flex items-start justify-between gap-2">
        <div className="space-y-1 min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <Badge className={cn("border", SEVERITY_BADGE[sev])}>{SEVERITY_LABEL[sev]}</Badge>
            <Badge
              variant="outline"
              className="text-[10px] gap-1 border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"
            >
              <CheckCircle2 className="h-3 w-3" /> Mitigated
            </Badge>
            {byClient && (
              <Badge variant="outline" className="text-[10px]">
                via client
              </Badge>
            )}
          </div>
          <p className="font-medium text-sm">{risk.title}</p>
          {notes && (
            <p className="text-xs text-muted-foreground whitespace-pre-wrap line-clamp-3">{notes}</p>
          )}
        </div>
        <Button size="sm" variant="outline" onClick={onReopen} disabled={isReopening}>
          {isReopening ? (
            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
          ) : (
            <RotateCcw className="h-4 w-4 mr-2" />
          )}
          Reopen
        </Button>
      </div>
    </div>
  );
}


function UnmitigatedRow({
  risk,
  onSaveStrategy,
  onMarkMitigated,
}: {
  risk: RiskRow;
  onSaveStrategy: (s: string) => void;
  onMarkMitigated: (s: string) => void | Promise<void>;
}) {
  const saved = risk.mitigation_strategy ?? "";
  const [strategy, setStrategy] = useState(saved);
  const [aiSuggested, setAiSuggested] = useState(false);
  const [sources, setSources] = useState<SuggestedSource[]>([]);
  const suggest = useSuggestRiskMitigation();
  const updateRisk = useUpdateRisk(risk.solicitation_id);
  const { user } = useUser();
  const sev = (risk.severity ?? "medium") as RiskSeverity;
  const sentToClient = (risk as any).sent_to_client === true;

  const hasUnsaved = strategy !== saved;

  const handleSendToClient = async () => {
    try {
      await updateRisk.mutateAsync({
        id: risk.id,
        updates: {
          sent_to_client: true,
          sent_to_client_at: new Date().toISOString(),
          sent_to_client_by: user?.id ?? null,
        } as any,
      });
      toast({ title: "Sent to client", description: "Client can now edit notes and mark mitigated." });
    } catch (e) {
      toast({
        title: "Could not send",
        description: e instanceof Error ? e.message : String(e),
        variant: "destructive",
      });
    }
  };

  const handleUnsend = async () => {
    try {
      await updateRisk.mutateAsync({
        id: risk.id,
        updates: {
          sent_to_client: false,
          sent_to_client_at: null,
          sent_to_client_by: null,
        } as any,
      });
      toast({ title: "Recalled from client" });
    } catch (e) {
      toast({
        title: "Could not recall",
        description: e instanceof Error ? e.message : String(e),
        variant: "destructive",
      });
    }
  };

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
            {sentToClient && (
              <Badge variant="outline" className="text-[10px] gap-1 border-blue-500/40 bg-blue-500/10 text-blue-700 dark:text-blue-300">
                <Clock className="h-3 w-3" /> Awaiting client
              </Badge>
            )}
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
        {sentToClient ? (
          <Button
            size="sm"
            variant="outline"
            onClick={handleUnsend}
            disabled={updateRisk.isPending}
          >
            <X className="h-4 w-4 mr-2" /> Recall from client
          </Button>
        ) : (
          <Button
            size="sm"
            variant="outline"
            onClick={handleSendToClient}
            disabled={updateRisk.isPending}
          >
            <Send className="h-4 w-4 mr-2" /> Send to client
          </Button>
        )}
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
    </div>
  );
}
