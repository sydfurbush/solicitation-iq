import { formatDistanceToNow } from "date-fns";
import { AlertTriangle, RefreshCw, Sparkles } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { ExecutiveSummaryCard } from "./ExecutiveSummaryCard";
import { KeyRequirementsCard } from "./KeyRequirementsCard";
import { EvaluationFactorsCard } from "./EvaluationFactorsCard";
import { IncumbentAnalysisCard } from "./IncumbentAnalysisCard";
import { ContractStructureCard } from "./ContractStructureCard";
import type { SolicitationInsights } from "../hooks/useAnalysis";

interface Props {
  solicitationId: string;
  insights: SolicitationInsights;
  onRerun: () => void;
  isRerunning: boolean;
}

export function AnalysisDashboard({ solicitationId, insights, onRerun, isRerunning }: Props) {
  const confidence = insights.confidence_score;
  const confidencePct = confidence != null ? Math.round(confidence * 100) : null;
  const lastAnalyzed = insights.metadata?.last_analyzed_at;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border bg-card p-4">
        <div className="flex items-center gap-3">
          <div className="h-9 w-9 rounded-md bg-primary/10 text-primary flex items-center justify-center">
            <Sparkles className="h-4 w-4" />
          </div>
          <div>
            <p className="text-sm font-medium">AI analysis ready</p>
            <p className="text-xs text-muted-foreground">
              {lastAnalyzed
                ? `Last analyzed ${formatDistanceToNow(new Date(lastAnalyzed))} ago`
                : "Analyzed"}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-4">
          {confidencePct != null && (
            <div className="flex items-center gap-2 min-w-[140px]">
              <span className="text-xs text-muted-foreground whitespace-nowrap">Confidence</span>
              <Progress value={confidencePct} className="h-2 w-20" />
              <Badge variant="secondary" className="tabular-nums">{confidencePct}%</Badge>
            </div>
          )}
          <Button variant="outline" size="sm" onClick={onRerun} disabled={isRerunning}>
            <RefreshCw className={`h-4 w-4 mr-2 ${isRerunning ? "animate-spin" : ""}`} />
            Re-run analysis
          </Button>
        </div>
      </div>

      {(insights.metadata?.validation_warnings?.length ?? 0) > 0 && (() => {
        const warnings = insights.metadata!.validation_warnings!;
        const missing = warnings.filter((w) => w.field === "missing_requirement" || w.severity === "error");
        const coverage = warnings.filter((w) => w.field === "coverage");
        const others = warnings.filter(
          (w) => w.field !== "coverage" && w.field !== "missing_requirement" && w.severity !== "error",
        );
        return (
          <div className="space-y-2">
            {missing.length > 0 && (
              <Alert variant="destructive">
                <AlertTriangle className="h-4 w-4" />
                <AlertTitle>Critical requirements possibly missed</AlertTitle>
                <AlertDescription>
                  <ul className="list-disc pl-5 space-y-1">
                    {missing.map((w, i) => (
                      <li key={i}>{w.message}</li>
                    ))}
                  </ul>
                </AlertDescription>
              </Alert>
            )}
            {coverage.length > 0 && (
              <Alert variant="default" className="border-amber-500/50 bg-amber-500/5">
                <AlertTriangle className="h-4 w-4 text-amber-600" />
                <AlertTitle>Possible coverage gaps</AlertTitle>
                <AlertDescription>
                  <ul className="list-disc pl-5 space-y-1">
                    {coverage.map((w, i) => (
                      <li key={i}>{w.message}</li>
                    ))}
                  </ul>
                </AlertDescription>
              </Alert>
            )}
            {others.length > 0 && (
              <Alert variant="default" className="border-amber-500/50 bg-amber-500/5">
                <AlertTriangle className="h-4 w-4 text-amber-600" />
                <AlertTitle>Possible inconsistency with known fields</AlertTitle>
                <AlertDescription>
                  The AI summary mentioned terms that conflict with structured solicitation data:{" "}
                  {others
                    .map((w) => w.message ?? `${w.field} expected "${w.expected}", found "${w.found}"`)
                    .join("; ")}
                  . Review and edit the summary if needed.
                </AlertDescription>
              </Alert>
            )}
          </div>
        );
      })()}


      <div className="grid gap-4 lg:grid-cols-2">
        <ExecutiveSummaryCard solicitationId={solicitationId} summary={insights.ai_summary} />
        <KeyRequirementsCard solicitationId={solicitationId} requirements={insights.key_requirements} />
        <EvaluationFactorsCard factors={insights.evaluation_factors} />
        <ContractStructureCard structure={insights.metadata?.contract_structure ?? null} />
        <IncumbentAnalysisCard
          info={insights.metadata?.incumbent_info}
          fallbackName={insights.incumbent_name}
          fallbackContractNumber={insights.incumbent_contract_number}
        />
      </div>
    </div>
  );
}
