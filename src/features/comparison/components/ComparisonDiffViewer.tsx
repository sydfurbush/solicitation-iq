import { useEffect, useMemo, useRef } from "react";
import { computeTextDiff, type DiffPart } from "../utils/diffHelpers";
import { cn } from "@/lib/utils";

type Props = {
  oldText: string;
  newText: string;
  mode?: "inline" | "side-by-side" | "stacked";
  granularity?: "words" | "lines";
  onlyChanges?: boolean;
  className?: string;
  enableKeyboardNav?: boolean;
};

export function ComparisonDiffViewer({
  oldText,
  newText,
  mode = "inline",
  granularity = "words",
  onlyChanges = false,
  className,
  enableKeyboardNav = false,
}: Props) {
  const diff = useMemo(
    () => computeTextDiff(oldText ?? "", newText ?? "", granularity),
    [oldText, newText, granularity],
  );

  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!enableKeyboardNav) return;
    const handler = (e: KeyboardEvent) => {
      if (!["j", "k"].includes(e.key)) return;
      if ((e.target as HTMLElement)?.tagName?.match(/INPUT|TEXTAREA/)) return;
      const root = containerRef.current;
      if (!root) return;
      const marks = Array.from(root.querySelectorAll<HTMLElement>("[data-change='1']"));
      if (!marks.length) return;
      const scrollTop = root.scrollTop;
      const viewportTop = root.getBoundingClientRect().top;
      const idxs = marks.map((m) => m.getBoundingClientRect().top - viewportTop + scrollTop);
      let target: number | null = null;
      if (e.key === "j") {
        target = idxs.find((y) => y > scrollTop + 8) ?? idxs[0];
      } else {
        const before = idxs.filter((y) => y < scrollTop - 8);
        target = before.length ? before[before.length - 1] : idxs[idxs.length - 1];
      }
      if (target != null) root.scrollTo({ top: target - 40, behavior: "smooth" });
      e.preventDefault();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [enableKeyboardNav]);

  if (mode === "side-by-side" || mode === "stacked") {
    const leftParts = diff.filter((p) => !p.added);
    const rightParts = diff.filter((p) => !p.removed);
    const wrap = mode === "stacked" ? "grid grid-rows-2 gap-3" : "grid md:grid-cols-2 gap-3";
    return (
      <div ref={containerRef} className={cn(wrap, "text-sm overflow-auto max-h-[70vh]", className)}>
        <Pane title="Prior" tone="removed" parts={leftParts} onlyChanges={onlyChanges} />
        <Pane title="Current" tone="added" parts={rightParts} onlyChanges={onlyChanges} />
      </div>
    );
  }

  return (
    <div ref={containerRef} className={cn("overflow-auto max-h-[70vh]", className)}>
      <pre className="whitespace-pre-wrap font-sans text-sm rounded-md border p-3 bg-muted/20">
        {diff.map((p: DiffPart, i: number) => (
          <span
            key={i}
            data-change={p.added || p.removed ? "1" : undefined}
            className={cn(
              p.added && "bg-emerald-500/20 text-emerald-700 dark:text-emerald-400",
              p.removed && "bg-destructive/20 text-destructive line-through",
              onlyChanges && !p.added && !p.removed && "text-muted-foreground/40",
            )}
          >
            {p.value}
          </span>
        ))}
      </pre>
    </div>
  );
}

function Pane({
  title,
  tone,
  parts,
  onlyChanges,
}: {
  title: string;
  tone: "added" | "removed";
  parts: DiffPart[];
  onlyChanges: boolean;
}) {
  const accent = tone === "removed" ? "bg-destructive/5 text-destructive" : "bg-emerald-500/5 text-emerald-600";
  return (
    <div className="rounded-md border p-3">
      <p className={cn("text-xs uppercase tracking-wide mb-1", accent.split(" ")[1])}>{title}</p>
      <pre className="whitespace-pre-wrap font-sans">
        {parts.map((p, i) => {
          const changed = p.added || p.removed;
          if (onlyChanges && !changed) {
            return (
              <span key={i} className="text-muted-foreground/40">
                {p.value.length > 80 ? "…" : p.value}
              </span>
            );
          }
          return (
            <span
              key={i}
              data-change={changed ? "1" : undefined}
              className={cn(
                p.removed && "bg-destructive/20 line-through",
                p.added && "bg-emerald-500/20",
              )}
            >
              {p.value}
            </span>
          );
        })}
      </pre>
    </div>
  );
}
