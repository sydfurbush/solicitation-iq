import { useState } from "react";
import { Loader2, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "@/hooks/use-toast";
import { useRisks, useIdentifyRisksOpportunities, useRisksOpportunitiesJobStatus } from "@/features/risks/hooks/useRisks";
import { useOpportunities } from "@/features/opportunities/hooks/useOpportunities";
import { RisksOpportunitiesDashboard } from "@/features/analysis/components/RisksOpportunitiesDashboard";
import { RiskMitigationTracker } from "@/features/analysis/components/RiskMitigationTracker";
import { OpportunityActionPlan } from "@/features/analysis/components/OpportunityActionPlan";
import { CompetitivePositionSummary } from "@/features/analysis/components/CompetitivePositionSummary";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

interface Props {
  solicitationId: string;
}

type View = "combined" | "risks" | "opportunities";

export default function SolicitationRisksOpportunities({ solicitationId }: Props) {
  const { data: risks = [], isLoading: rl } = useRisks(solicitationId);
  const { data: opportunities = [], isLoading: ol } = useOpportunities(solicitationId);
  const identify = useIdentifyRisksOpportunities(solicitationId);
  const { data: job } = useRisksOpportunitiesJobStatus(solicitationId);
  const [view, setView] = useState<View>("combined");

  const isLoading = rl || ol;
  const isProcessing = identify.isPending || job?.status === "processing";
  const isFailed = job?.status === "failed";
  const hasAny = risks.length > 0 || opportunities.length > 0;

  const handleIdentify = async () => {
    try {
      const data = await identify.mutateAsync({ regenerate: hasAny });
      toast({
        title: hasAny ? "Re-analyzed" : "Analysis complete",
        description: `${data?.risks_count ?? 0} risks · ${data?.opportunities_count ?? 0} opportunities`,
      });
    } catch (e) {
      toast({
        title: "AI analysis failed",
        description: e instanceof Error ? e.message : String(e),
        variant: "destructive",
      });
    }
  };

  if (isLoading) {
    return (
      <div className="py-16 flex justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!hasAny) {
    return (
      <Card>
        <CardContent className="py-16 text-center space-y-4">
          <Sparkles className="h-10 w-10 mx-auto text-primary" />
          <div>
            <h3 className="font-semibold">No risks or opportunities yet</h3>
            <p className="text-sm text-muted-foreground">
              Run AI analysis to identify risks and competitive opportunities from processed documents.
            </p>
          </div>
          <Button onClick={handleIdentify} disabled={identify.isPending}>
            {identify.isPending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Sparkles className="h-4 w-4 mr-2" />}
            Identify risks &amp; opportunities
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div className="space-y-1">
          <div className="flex items-center gap-2 flex-wrap">
            <h2 className="text-xl font-semibold">Risks &amp; opportunities</h2>
            {isProcessing && (
              <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
                <Loader2 className="h-3 w-3 animate-spin" />
                Analyzing in background…
              </span>
            )}
            {!isProcessing && isFailed && (
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Badge variant="destructive" className="cursor-help">
                      Last run failed — click Re-analyze
                    </Badge>
                  </TooltipTrigger>
                  {job?.error_message && (
                    <TooltipContent className="max-w-sm">
                      <p className="text-xs">{job.error_message}</p>
                    </TooltipContent>
                  )}
                </Tooltip>
              </TooltipProvider>
            )}
          </div>
          <p className="text-sm text-muted-foreground">
            AI-identified threats and competitive openings, with manual overrides.
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <Button size="sm" onClick={handleIdentify} disabled={isProcessing}>
            {isProcessing ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <Sparkles className="h-4 w-4 mr-2" />
            )}
            {isProcessing ? "Analyzing…" : hasAny ? "Re-analyze" : "Identify risks & opportunities"}
          </Button>
          <Tabs value={view} onValueChange={(v) => setView(v as View)}>
            <TabsList>
              <TabsTrigger value="combined">Combined</TabsTrigger>
              <TabsTrigger value="risks">Risks</TabsTrigger>
              <TabsTrigger value="opportunities">Opportunities</TabsTrigger>
            </TabsList>
          </Tabs>
        </div>
      </div>

      <CompetitivePositionSummary risks={risks} opportunities={opportunities} />

      <div className="grid lg:grid-cols-2 gap-4">
        {risks.length > 0 && (
          <RiskMitigationTracker solicitationId={solicitationId} risks={risks} />
        )}
        {opportunities.length > 0 && (
          <OpportunityActionPlan opportunities={opportunities} />
        )}
      </div>

      <RisksOpportunitiesDashboard solicitationId={solicitationId} view={view} />
    </div>
  );
}
