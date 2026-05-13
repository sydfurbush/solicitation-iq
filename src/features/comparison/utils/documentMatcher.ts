// Match documents across two revisions of a solicitation.
// Strategy:
// 1) Direct chain via documents.replaces_document_id (strongest signal)
// 2) Exact filename match (case-insensitive, whitespace-normalized)
// 3) Fuzzy similarity on filename (token-overlap >= 0.6)
// Unmatched docs from A => "removed", from B => "added".

export type DocLite = {
  id: string;
  file_name: string;
  total_pages: number | null;
  replaces_document_id: string | null;
  revision_id: string | null;
};

export type DocMatchStatus = "unchanged" | "modified" | "added" | "removed";

export type DocMatch = {
  status: DocMatchStatus;
  a: DocLite | null;
  b: DocLite | null;
  pageDelta: number | null;
  similarity: number | null;
};

function norm(s: string): string {
  return s.toLowerCase().replace(/\.[a-z0-9]+$/i, "").replace(/[\s_\-()]+/g, " ").trim();
}

function tokenSimilarity(a: string, b: string): number {
  const ta = new Set(norm(a).split(" ").filter(Boolean));
  const tb = new Set(norm(b).split(" ").filter(Boolean));
  if (!ta.size || !tb.size) return 0;
  let inter = 0;
  ta.forEach((t) => { if (tb.has(t)) inter++; });
  return inter / Math.max(ta.size, tb.size);
}

export function matchDocuments(aDocs: DocLite[], bDocs: DocLite[]): DocMatch[] {
  const matches: DocMatch[] = [];
  const usedA = new Set<string>();
  const usedB = new Set<string>();

  // 1) replaces_document_id chain
  bDocs.forEach((b) => {
    if (b.replaces_document_id) {
      const a = aDocs.find((x) => x.id === b.replaces_document_id);
      if (a && !usedA.has(a.id) && !usedB.has(b.id)) {
        usedA.add(a.id);
        usedB.add(b.id);
        matches.push({ status: "modified", a, b, pageDelta: pageDelta(a, b), similarity: 1 });
      }
    }
  });

  // 2) exact filename
  bDocs.forEach((b) => {
    if (usedB.has(b.id)) return;
    const a = aDocs.find((x) => !usedA.has(x.id) && norm(x.file_name) === norm(b.file_name));
    if (a) {
      usedA.add(a.id);
      usedB.add(b.id);
      const pd = pageDelta(a, b);
      matches.push({
        status: pd === 0 && a.file_name === b.file_name ? "unchanged" : "modified",
        a,
        b,
        pageDelta: pd,
        similarity: 1,
      });
    }
  });

  // 3) fuzzy
  const remainingB = bDocs.filter((b) => !usedB.has(b.id));
  remainingB.forEach((b) => {
    let best: { a: DocLite; sim: number } | null = null;
    aDocs.forEach((a) => {
      if (usedA.has(a.id)) return;
      const sim = tokenSimilarity(a.file_name, b.file_name);
      if (sim >= 0.6 && (!best || sim > best.sim)) best = { a, sim };
    });
    if (best) {
      usedA.add(best.a.id);
      usedB.add(b.id);
      matches.push({ status: "modified", a: best.a, b, pageDelta: pageDelta(best.a, b), similarity: best.sim });
    }
  });

  // Added (unmatched in B)
  bDocs.forEach((b) => {
    if (!usedB.has(b.id)) matches.push({ status: "added", a: null, b, pageDelta: null, similarity: null });
  });
  // Removed (unmatched in A)
  aDocs.forEach((a) => {
    if (!usedA.has(a.id)) matches.push({ status: "removed", a, b: null, pageDelta: null, similarity: null });
  });

  // Sort: modified first, then added, removed, unchanged
  const order: Record<DocMatchStatus, number> = { modified: 0, added: 1, removed: 2, unchanged: 3 };
  matches.sort((x, y) => order[x.status] - order[y.status] || (x.b?.file_name ?? x.a?.file_name ?? "").localeCompare(y.b?.file_name ?? y.a?.file_name ?? ""));
  return matches;
}

function pageDelta(a: DocLite, b: DocLite): number | null {
  if (a.total_pages == null || b.total_pages == null) return null;
  return b.total_pages - a.total_pages;
}
