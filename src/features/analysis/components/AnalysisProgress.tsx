import { useEffect, useState } from "react";
import { CheckCircle2, Loader2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";

const STEPS = [
  "Gathering documents",
  "Analyzing content",
  "Extracting requirements",
  "Generating insights",
  "Complete",
];

interface Props {
  onCancel?: () => void;
  estimatedSeconds?: number;
}

export function AnalysisProgress({ onCancel, estimatedSeconds = 60 }: Props) {
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => setElapsed((s) => s + 1), 1000);
    return () => clearInterval(interval);
  }, []);

  const progress = Math.min(95, (elapsed / estimatedSeconds) * 100);
  const stepIndex = Math.min(STEPS.length - 2, Math.floor((progress / 100) * (STEPS.length - 1)));
  const remaining = Math.max(0, estimatedSeconds - elapsed);

  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between space-y-0">
        <CardTitle className="flex items-center gap-2 text-base">
          <Loader2 className="h-4 w-4 animate-spin text-primary" />
          Running AI analysis
        </CardTitle>
        {onCancel && (
          <Button variant="ghost" size="sm" onClick={onCancel}>
            <X className="h-4 w-4 mr-1" /> Cancel
          </Button>
        )}
      </CardHeader>
      <CardContent className="space-y-4">
        <Progress value={progress} className="h-2" />
        <div className="flex justify-between text-xs text-muted-foreground">
          <span>{Math.round(progress)}%</span>
          <span>~{remaining}s remaining</span>
        </div>
        <ol className="space-y-2">
          {STEPS.map((label, i) => {
            const done = i < stepIndex;
            const active = i === stepIndex;
            return (
              <li
                key={label}
                className={cn(
                  "flex items-center gap-2 text-sm",
                  done ? "text-foreground" : active ? "text-primary font-medium" : "text-muted-foreground"
                )}
              >
                {done ? (
                  <CheckCircle2 className="h-4 w-4 text-primary" />
                ) : active ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <div className="h-4 w-4 rounded-full border" />
                )}
                {label}
              </li>
            );
          })}
        </ol>
      </CardContent>
    </Card>
  );
}
