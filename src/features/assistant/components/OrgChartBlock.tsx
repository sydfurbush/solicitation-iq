import { useMemo, useState } from "react";
import { ChevronDown, ChevronRight, Users } from "lucide-react";

/**
 * Heuristic detector: returns true for code blocks that look like ASCII
 * org charts / hierarchy diagrams (box-drawing chars, pipes-with-dashes,
 * or "Reports to:" phrasing).
 */
export function looksLikeOrgChart(code: string): boolean {
  if (!code) return false;
  const text = code;
  const lines = text.split("\n");
  if (lines.length < 3) return false;

  // Box-drawing characters
  if (/[│├└┌┐┘┴┬┼─━┃┏┓┗┛┣┫┳┻╋]/.test(text)) return true;

  // Multiple lines with "+---" or "|   |" style ASCII boxes
  const asciiBoxLines = lines.filter((l) => /\+-{2,}\+/.test(l) || /\|\s{2,}\|/.test(l)).length;
  if (asciiBoxLines >= 2) return true;

  // Vertical bar tree connectors (e.g. "  |  ", "  |__")
  const pipeTreeLines = lines.filter((l) => /^\s*\|[\s_-]*$/.test(l) || /\|__/.test(l)).length;
  if (pipeTreeLines >= 2 && /Reports to:|Manager|Lead|Specialist|Admin/i.test(text)) return true;

  // Phrasing common in org chart prose blocks
  if (/Reports to:/i.test(text) && /\|/.test(text) && lines.length >= 5) return true;

  return false;
}

type Role = {
  title: string;
  meta?: string;
  bullets: string[];
};

/**
 * Very forgiving parser — extracts role blocks from the ASCII chart by
 * looking for header lines (TitleCase or "Role (n)") followed by bullet
 * lines starting with "•" or "-" or "*". Falls back to no cards if
 * nothing reasonable is found.
 */
function parseRoles(text: string): Role[] {
  const lines = text
    .split("\n")
    .map((l) => l.replace(/[│├└┌┐┘┴┬┼─━┃┏┓┗┛┣┫┳┻╋|+_]/g, " "))
    .map((l) => l.replace(/\s+/g, " ").trim())
    .filter(Boolean);

  const roles: Role[] = [];
  let current: Role | null = null;

  const bulletRe = /^[•\-*]\s+(.+)/;
  const headerRe = /^([A-Z][A-Za-z0-9&/ +.-]{1,60}(?:\([^)]+\))?)\s*:?$/;

  for (const line of lines) {
    const bm = line.match(bulletRe);
    if (bm) {
      if (!current) current = { title: "Role", bullets: [] };
      current.bullets.push(bm[1]);
      continue;
    }
    const hm = line.match(headerRe);
    if (hm) {
      if (current && (current.bullets.length || current.meta)) roles.push(current);
      current = { title: hm[1].replace(/:$/, "").trim(), bullets: [] };
      continue;
    }
    // Treat "Reports to:" / "Certifications:" style meta lines as extra info
    if (/^Reports to:/i.test(line) || /Certifications?:/i.test(line)) {
      if (current) current.meta = (current.meta ? current.meta + " · " : "") + line;
    }
  }
  if (current && (current.bullets.length || current.meta)) roles.push(current);

  // Only return cards when we got at least 2 distinct roles with bullets
  const useful = roles.filter((r) => r.bullets.length > 0);
  return useful.length >= 2 ? useful : [];
}

export function OrgChartBlock({ code }: { code: string }) {
  const roles = useMemo(() => parseRoles(code), [code]);
  const [showRaw, setShowRaw] = useState(false);

  return (
    <div className="not-prose my-3 rounded-lg border border-border bg-card overflow-hidden">
      <div className="flex items-center justify-between gap-2 border-b border-border bg-muted/40 px-3 py-2">
        <div className="flex items-center gap-2 text-xs font-medium text-foreground">
          <Users className="h-3.5 w-3.5 text-muted-foreground" />
          Org chart
        </div>
        <button
          type="button"
          onClick={() => setShowRaw((v) => !v)}
          className="inline-flex items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground"
          aria-expanded={showRaw}
        >
          {showRaw ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
          {showRaw ? "Hide source" : "Show source"}
        </button>
      </div>

      {roles.length > 0 ? (
        <div className="p-3">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {roles.map((r, i) => (
              <div
                key={i}
                className="rounded-md border border-border bg-background p-3 shadow-sm"
              >
                <div className="text-sm font-semibold text-foreground leading-tight">
                  {r.title}
                </div>
                {r.meta && (
                  <div className="mt-1 text-[11px] text-muted-foreground">{r.meta}</div>
                )}
                {r.bullets.length > 0 && (
                  <ul className="mt-2 space-y-1 text-xs text-foreground/90">
                    {r.bullets.map((b, j) => (
                      <li key={j} className="flex gap-1.5">
                        <span className="text-muted-foreground">•</span>
                        <span>{b}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            ))}
          </div>
        </div>
      ) : (
        // Fallback: clean monospace render with horizontal scroll
        <pre className="overflow-x-auto p-3 text-[0.78rem] leading-relaxed whitespace-pre font-mono text-foreground/90">
          {code}
        </pre>
      )}

      {showRaw && roles.length > 0 && (
        <pre className="border-t border-border bg-muted/30 overflow-x-auto p-3 text-[0.75rem] leading-relaxed whitespace-pre font-mono text-muted-foreground">
          {code}
        </pre>
      )}
    </div>
  );
}
