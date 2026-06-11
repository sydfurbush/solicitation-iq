import { useEffect, useId, useRef, useState } from "react";
import mermaid from "mermaid";

let initialized = false;
function ensureInit() {
  if (initialized) return;
  mermaid.initialize({
    startOnLoad: false,
    securityLevel: "strict",
    theme: "neutral",
    fontFamily: "inherit",
    flowchart: { htmlLabels: true, curve: "basis" },
  });
  initialized = true;
}

export function MermaidBlock({ code }: { code: string }) {
  const id = useId().replace(/[^a-zA-Z0-9_-]/g, "");
  const [svg, setSvg] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let cancelled = false;
    ensureInit();
    mermaid
      .render(`mermaid-${id}`, code.trim())
      .then(({ svg }) => {
        if (!cancelled) setSvg(svg);
      })
      .catch((e) => {
        if (!cancelled) setError(e?.message ?? "Failed to render diagram");
      });
    return () => {
      cancelled = true;
    };
  }, [code, id]);

  if (error) {
    return (
      <pre className="not-prose my-3 overflow-x-auto rounded-md border border-border bg-muted/40 p-3 text-xs leading-relaxed whitespace-pre font-mono">
        {code}
      </pre>
    );
  }

  return (
    <div
      ref={containerRef}
      className="not-prose my-3 overflow-x-auto rounded-md border border-border bg-card p-3 [&_svg]:max-w-none [&_svg]:h-auto"
      dangerouslySetInnerHTML={svg ? { __html: svg } : undefined}
    />
  );
}
