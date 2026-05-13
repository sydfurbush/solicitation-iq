import { computeTextDiff, type DiffPart } from "./diffHelpers";

export type SectionLite = {
  id: string;
  document_id: string;
  section_number: string | null;
  section_title: string | null;
  page_start: number | null;
  page_end: number | null;
  content: string;
  sort_order: number | null;
};

export type SectionPairStatus = "unchanged" | "modified" | "added" | "removed";

export type SectionPair = {
  status: SectionPairStatus;
  a: SectionLite | null;
  b: SectionLite | null;
  density: number; // 0..1
  diff: DiffPart[] | null;
};

function keyOf(s: SectionLite): string {
  const num = (s.section_number ?? "").trim().toLowerCase();
  const title = (s.section_title ?? "").trim().toLowerCase();
  return num && title ? `${num}::${title}` : num || title;
}

export function changeDensity(diff: DiffPart[]): number {
  let changed = 0;
  let total = 0;
  diff.forEach((p) => {
    total += p.value.length;
    if (p.added || p.removed) changed += p.value.length;
  });
  return total === 0 ? 0 : Math.min(1, changed / total);
}

export function pairSections(aSecs: SectionLite[], bSecs: SectionLite[]): SectionPair[] {
  const result: SectionPair[] = [];
  const usedB = new Set<string>();
  const bMap = new Map<string, SectionLite>();
  bSecs.forEach((s) => {
    const k = keyOf(s);
    if (k && !bMap.has(k)) bMap.set(k, s);
  });

  aSecs.forEach((a) => {
    const k = keyOf(a);
    const b = k ? bMap.get(k) : undefined;
    if (b && !usedB.has(b.id)) {
      usedB.add(b.id);
      const same = (a.content ?? "").trim() === (b.content ?? "").trim();
      if (same) {
        result.push({ status: "unchanged", a, b, density: 0, diff: null });
      } else {
        const diff = computeTextDiff(a.content ?? "", b.content ?? "", "words");
        result.push({ status: "modified", a, b, density: changeDensity(diff), diff });
      }
    } else {
      result.push({ status: "removed", a, b: null, density: 1, diff: null });
    }
  });

  bSecs.forEach((b) => {
    if (!usedB.has(b.id)) {
      result.push({ status: "added", a: null, b, density: 1, diff: null });
    }
  });

  // Sort by sort_order of B (or A as fallback)
  result.sort((x, y) => {
    const ax = x.b?.sort_order ?? x.a?.sort_order ?? 0;
    const ay = y.b?.sort_order ?? y.a?.sort_order ?? 0;
    return ax - ay;
  });

  return result;
}
