import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { GitCompare, RefreshCw } from "lucide-react";
import { usePriorSolicitation, useComparisonResults } from "@/features/comparison/hooks/usePriorSolicitation";
import { useRunComparison } from "@/features/comparison/hooks/useRunComparison";
import { LinkPriorSolicitationDialog } from "@/features/comparison/components/LinkPriorSolicitationDialog";
import { ComparisonOverview } from "@/features/comparison/components/ComparisonOverview";
import { RequirementsComparison } from "@/features/comparison/components/RequirementsComparison";
import { EvaluationFactorsComparison } from "@/features/comparison/components/EvaluationFactorsComparison";
import { ScopeComparison } from "@/features/comparison/components/ScopeComparison";
import { TimelineComparison } from "@/features/comparison/components/TimelineComparison";
import { FinancialComparison } from "@/features/comparison/components/FinancialComparison";
import { ComparisonInsights } from "@/features/comparison/components/ComparisonInsights";
import { IncumbentSearchPanel } from "@/features/comparison/components/IncumbentSearchPanel";
import { RevisionComparisonPanel } from "@/features/comparison/components/RevisionComparisonPanel";
import { toast } from "@/hooks/use-toast";

export default function SolicitationComparison({ solicitationId }: { solicitationId: string }) {
  const { data: prior, isLoading } = usePriorSolicitation(solicitationId);
  const { changes, summary } = useComparisonResults(solicitationId);
  const compare = useRunComparison(solicitationId);

  if (isLoading) {
    return <Skeleton className="h-64 w-full" />;
  }

  if (!prior) {
    return (
      <div className="space-y-4">
        <RevisionComparisonPanel solicitationId={solicitationId} />
        <IncumbentSearchPanel solicitationId={solicitationId} />
        <Card>
          <CardContent className="py-12 text-center space-y-4">
            <div className="mx-auto h-12 w-12 rounded-full bg-primary/10 text-primary flex items-center justify-center">
              <GitCompare className="h-6 w-6" />
            </div>
            <div>
              <p className="font-medium">No prior solicitation linked</p>
              <p className="text-sm text-muted-foreground mt-1">
                Want to compare against a different solicitation entirely? Link one here for AI-powered strategic analysis.
              </p>
            </div>
            <LinkPriorSolicitationDialog solicitationId={solicitationId} />
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!prior.comparison_completed_at) {
    return (
      <Card>
        <CardContent className="py-12 text-center space-y-4">
          <div className="mx-auto h-12 w-12 rounded-full bg-primary/10 text-primary flex items-center justify-center">
            <RefreshCw className={compare.isPending ? "h-6 w-6 animate-spin" : "h-6 w-6"} />
          </div>
          <div>
            <p className="font-medium">Prior solicitation linked</p>
            <p className="text-sm text-muted-foreground mt-1">Run the comparison to identify changes.</p>
          </div>
          <Button
            onClick={() =>
              compare.mutate(
                { priorSolicitationId: prior.prior_solicitation_id, priorRecordId: prior.id },
                {
                  onSuccess: () => toast({ title: "Comparison complete" }),
                  onError: (e) => toast({ title: "Failed", description: e instanceof Error ? e.message : String(e), variant: "destructive" }),
                }
              )
            }
            disabled={compare.isPending}
          >
            {compare.isPending ? "Analyzing…" : "Run comparison"}
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <ComparisonOverview solicitationId={solicitationId} priorRecord={prior} changes={changes} />

      <Tabs defaultValue="requirements">
        <TabsList className="flex flex-wrap h-auto">
          <TabsTrigger value="requirements">Requirements</TabsTrigger>
          <TabsTrigger value="evaluation">Evaluation</TabsTrigger>
          <TabsTrigger value="scope">Scope</TabsTrigger>
          <TabsTrigger value="timeline">Timeline</TabsTrigger>
          <TabsTrigger value="financial">Financial</TabsTrigger>
          <TabsTrigger value="insights">Insights</TabsTrigger>
        </TabsList>

        <TabsContent value="requirements" className="mt-4">
          <RequirementsComparison items={changes?.requirements ?? []} />
        </TabsContent>
        <TabsContent value="evaluation" className="mt-4">
          <EvaluationFactorsComparison items={changes?.evaluation_factors ?? []} />
        </TabsContent>
        <TabsContent value="scope" className="mt-4">
          <ScopeComparison items={changes?.scope ?? []} summary={summary} />
        </TabsContent>
        <TabsContent value="timeline" className="mt-4">
          <TimelineComparison items={changes?.timeline ?? []} />
        </TabsContent>
        <TabsContent value="financial" className="mt-4">
          <FinancialComparison items={changes?.financial ?? []} />
        </TabsContent>
        <TabsContent value="insights" className="mt-4">
          <ComparisonInsights insights={changes?.insights ?? []} recommendations={changes?.recommendations ?? []} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
