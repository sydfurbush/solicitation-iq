import { diffWords, diffLines } from "diff";

export type DiffPart = { value: string; added?: boolean; removed?: boolean };

export function computeTextDiff(oldText: string, newText: string, mode: "words" | "lines" = "words"): DiffPart[] {
  if (mode === "lines") return diffLines(oldText ?? "", newText ?? "");
  return diffWords(oldText ?? "", newText ?? "");
}

export function summarizeChanges(diff: DiffPart[]): { added: number; removed: number } {
  let added = 0;
  let removed = 0;
  diff.forEach((p) => {
    if (p.added) added += p.value.length;
    if (p.removed) removed += p.value.length;
  });
  return { added, removed };
}

export function categorizeChange(change: { type?: string; significance?: string }) {
  return {
    type: (change.type as "added" | "removed" | "modified") ?? "modified",
    significance: (change.significance as "high" | "medium" | "low") ?? "medium",
  };
}

export function pctDelta(prior: number | null | undefined, current: number | null | undefined) {
  if (!prior || prior === 0 || current == null) return null;
  return ((current - prior) / prior) * 100;
}

export function fmtCurrency(v: number | null | undefined) {
  if (v == null) return "—";
  return v.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });
}

export function fmtDate(v: string | null | undefined) {
  if (!v) return "—";
  try {
    return new Date(v).toLocaleDateString();
  } catch {
    return v;
  }
}
