import { useMemo } from "react";
import { computeTextDiff, type DiffPart } from "../utils/diffHelpers";
import { cn } from "@/lib/utils";

type Props = {
  oldText: string;
  newText: string;
  mode?: "inline" | "side-by-side";
  granularity?: "words" | "lines";
  className?: string;
};

export function ComparisonDiffViewer({ oldText, newText, mode = "inline", granularity = "words", className }: Props) {
  const diff = useMemo(() => computeTextDiff(oldText ?? "", newText ?? "", granularity), [oldText, newText, granularity]);

  if (mode === "side-by-side") {
    return (
      <div className={cn("grid md:grid-cols-2 gap-3 text-sm", className)}>
        <div className="rounded-md border p-3 bg-destructive/5">
          <p className="text-xs uppercase tracking-wide text-destructive mb-1">Prior</p>
          <pre className="whitespace-pre-wrap font-sans">
            {diff.filter((p) => !p.added).map((p, i) => (
              <span key={i} className={p.removed ? "bg-destructive/20 line-through" : ""}>{p.value}</span>
            ))}
          </pre>
        </div>
        <div className="rounded-md border p-3 bg-emerald-500/5">
          <p className="text-xs uppercase tracking-wide text-emerald-600 mb-1">Current</p>
          <pre className="whitespace-pre-wrap font-sans">
            {diff.filter((p) => !p.removed).map((p, i) => (
              <span key={i} className={p.added ? "bg-emerald-500/20" : ""}>{p.value}</span>
            ))}
          </pre>
        </div>
      </div>
    );
  }

  return (
    <pre className={cn("whitespace-pre-wrap font-sans text-sm rounded-md border p-3 bg-muted/20", className)}>
      {diff.map((p: DiffPart, i: number) => (
        <span
          key={i}
          className={cn(
            p.added && "bg-emerald-500/20 text-emerald-700 dark:text-emerald-400",
            p.removed && "bg-destructive/20 text-destructive line-through"
          )}
        >
          {p.value}
        </span>
      ))}
    </pre>
  );
}
