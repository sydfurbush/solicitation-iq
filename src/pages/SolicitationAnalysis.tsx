import { useEffect, useState } from "react";
import { AlertCircle, FileWarning, Sparkles } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "@/hooks/use-toast";
import { AnalysisDashboard } from "@/features/analysis/components/AnalysisDashboard";
import { AnalysisProgress } from "@/features/analysis/components/AnalysisProgress";
import {
  useAnalysisJob,
  useRunAnalysis,
  useSolicitationInsights,
} from "@/features/analysis/hooks/useAnalysis";

interface Props {
  solicitationId: string;
}

const JOB_KEY_PREFIX = "analysis-job:";

export default function SolicitationAnalysis({ solicitationId }: Props) {
  const { data: insights, isLoading } = useSolicitationInsights(solicitationId);
  const runAnalysis = useRunAnalysis(solicitationId);
  const [error, setError] = useState<string | null>(null);
  const [jobId, setJobId] = useState<string | null>(() => {
    if (typeof window === "undefined") return null;
    return localStorage.getItem(JOB_KEY_PREFIX + solicitationId);
  });

  const job = useAnalysisJob(jobId, solicitationId);
  const isJobActive = !!job && (job.status === "queued" || job.status === "running");

  const hasAnalysis = !!insights?.ai_summary || (insights?.key_requirements?.length ?? 0) > 0;

  // Persist active job id so navigating away and back keeps progress visible
  useEffect(() => {
    if (!jobId) return;
    localStorage.setItem(JOB_KEY_PREFIX + solicitationId, jobId);
  }, [jobId, solicitationId]);

  useEffect(() => {
    if (!job) return;
    if (job.status === "completed") {
      toast({ title: "Analysis complete", description: "Strategic intelligence generated." });
      localStorage.removeItem(JOB_KEY_PREFIX + solicitationId);
      setJobId(null);
    } else if (job.status === "failed") {
      setError(job.error_message ?? "Analysis failed");
      toast({ title: "Analysis failed", description: job.error_message ?? "Unknown error", variant: "destructive" });
      localStorage.removeItem(JOB_KEY_PREFIX + solicitationId);
      setJobId(null);
    }
  }, [job?.status, job?.error_message, solicitationId]);

  const handleRun = async () => {
    setError(null);
    try {
      const { jobId: newJobId } = await runAnalysis.mutateAsync("full");
      setJobId(newJobId);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      setError(msg);
      toast({ title: "Failed to queue analysis", description: msg, variant: "destructive" });
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-20 w-full" />
        <div className="grid gap-4 lg:grid-cols-2">
          <Skeleton className="h-64" />
          <Skeleton className="h-64" />
        </div>
      </div>
    );
  }

  if (runAnalysis.isPending || isJobActive) {
    const stepLabel = job?.progress_step
      ? job.progress_step.replace(/_/g, " ")
      : job?.status === "queued"
        ? "Queued — starting worker"
        : "Starting analysis";
    return (
      <div className="space-y-3">
        <AnalysisProgress estimatedSeconds={180} />
        <p className="text-xs text-muted-foreground text-center">
          Status: <span className="font-medium capitalize">{job?.status ?? "queued"}</span> · {stepLabel}
        </p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-4">
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Analysis failed</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
        <Button onClick={handleRun}>Retry analysis</Button>
        {hasAnalysis && insights && (
          <AnalysisDashboard
            solicitationId={solicitationId}
            insights={insights}
            onRerun={handleRun}
            isRerunning={runAnalysis.isPending}
          />
        )}
      </div>
    );
  }

  if (!hasAnalysis) {
    return (
      <Card>
        <CardContent className="py-16 flex flex-col items-center text-center max-w-xl mx-auto space-y-4">
          <div className="h-14 w-14 rounded-full bg-primary/10 text-primary flex items-center justify-center">
            <Sparkles className="h-6 w-6" />
          </div>
          <div className="space-y-1">
            <h3 className="text-lg font-semibold">Run AI analysis</h3>
            <p className="text-sm text-muted-foreground">
              Analyze all processed documents to extract an executive summary, key requirements, evaluation factors, incumbent signals, and contract structure.
            </p>
          </div>
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <FileWarning className="h-4 w-4" />
            Documents must be uploaded and processed first.
          </div>
          <Button size="lg" onClick={handleRun}>
            <Sparkles className="h-4 w-4 mr-2" /> Run analysis
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <AnalysisDashboard
      solicitationId={solicitationId}
      insights={insights!}
      onRerun={handleRun}
      isRerunning={runAnalysis.isPending}
    />
  );
}
