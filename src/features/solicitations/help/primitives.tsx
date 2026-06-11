import { ReactNode } from "react";
import { cn } from "@/lib/utils";

export function HelpSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="space-y-2">
      <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">{title}</h3>
      <div className="text-sm leading-relaxed space-y-2">{children}</div>
    </section>
  );
}

export function HelpSteps({
  items,
  accentClass,
}: {
  items: { title: string; body: string; result?: string }[];
  accentClass?: string;
}) {
  return (
    <ol className="space-y-3">
      {items.map((s, i) => (
        <li
          key={i}
          className="flex gap-3 rounded-md border border-border/60 bg-muted/20 p-3"
        >
          <span
            className={cn(
              "flex-none mt-0.5 inline-flex h-6 w-6 items-center justify-center rounded-full text-xs font-semibold",
              accentClass ?? "bg-muted text-foreground",
            )}
          >
            {i + 1}
          </span>
          <div className="min-w-0 flex-1 space-y-1">
            <p className="text-sm font-semibold leading-tight">{s.title}</p>
            <p className="text-sm text-muted-foreground leading-relaxed">{s.body}</p>
            {s.result && (
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground/80">
                <span className="text-foreground/70">Result: </span>
                <span className="normal-case font-normal tracking-normal">
                  {s.result}
                </span>
              </p>
            )}
          </div>
        </li>
      ))}
    </ol>
  );
}

export function HelpCallout({
  tone = "info",
  title,
  children,
}: {
  tone?: "info" | "warn" | "client";
  title?: string;
  children: ReactNode;
}) {
  return (
    <div
      className={cn(
        "rounded-md border p-3 text-sm",
        tone === "info" && "border-border bg-muted/40",
        tone === "warn" && "border-amber-500/30 bg-amber-500/5",
        tone === "client" && "border-primary/30 bg-primary/5",
      )}
    >
      {title && <p className="font-medium mb-1">{title}</p>}
      <div className="text-muted-foreground">{children}</div>
    </div>
  );
}

export function HelpBullets({ items }: { items: string[] }) {
  return (
    <ul className="list-disc list-inside space-y-1 text-sm text-muted-foreground">
      {items.map((t, i) => <li key={i}>{t}</li>)}
    </ul>
  );
}
