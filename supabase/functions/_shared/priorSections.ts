// Shared helper for building the "PRIOR SECTIONS ALREADY DRAFTED" context
// block used by draft-section and polish-section.

type SupabaseLike = {
  from: (table: string) => any;
};

export type OutlineNodeLite = {
  id: string;
  parent_id: string | null;
  sort_order: number;
  section_number: string | null;
  title: string;
  volume: string | null;
};

const fmt = (n: { section_number: string | null; title: string }) =>
  `${n.section_number ? n.section_number + " " : ""}${n.title}`;

export async function buildPriorSectionsBlock(opts: {
  supabase: SupabaseLike;
  outlineId: string;
  currentNodeId: string;
  currentSortOrder: number;
  totalCharBudget?: number;
  perSectionCharBudget?: number;
}): Promise<{ block: string; allNodes: OutlineNodeLite[] }> {
  const TOTAL_BUDGET = opts.totalCharBudget ?? 5000;
  const PER = opts.perSectionCharBudget ?? 500;

  const { data: allNodes } = await opts.supabase
    .from("outline_nodes")
    .select("id, parent_id, sort_order, section_number, title, volume")
    .eq("outline_id", opts.outlineId)
    .order("sort_order", { ascending: true });

  const arr = (allNodes ?? []) as OutlineNodeLite[];
  const prior = arr.filter((n) => n.id !== opts.currentNodeId && n.sort_order < opts.currentSortOrder);
  const priorIds = prior.map((n) => n.id);

  const { data: priorDraftsRaw } = priorIds.length
    ? await opts.supabase
        .from("proposal_drafts")
        .select("outline_node_id, content_json, content_html, word_count")
        .in("outline_node_id", priorIds)
    : { data: [] };

  const map = new Map<string, { md: string; words: number }>();
  for (const d of (priorDraftsRaw ?? []) as Array<{ outline_node_id: string; content_json: any; content_html: string | null; word_count: number | null }>) {
    const md = String(d.content_json?.markdown ?? d.content_html ?? "").trim();
    if (md.length > 0) map.set(d.outline_node_id, { md, words: d.word_count ?? 0 });
  }

  const ordered = prior.filter((n) => map.has(n.id)).sort((a, b) => a.sort_order - b.sort_order);
  if (ordered.length === 0) {
    return { block: "PRIOR SECTIONS ALREADY DRAFTED\n(none — this is the first section being drafted)", allNodes: arr };
  }

  const includedSummaries: string[] = [];
  let used = 0;
  for (const n of [...ordered].reverse()) {
    const entry = map.get(n.id)!;
    const snippet = entry.md.replace(/\s+/g, " ").slice(0, PER);
    const line = `### ${fmt(n)} (~${entry.words} words)\n${snippet}${entry.md.length > PER ? "…" : ""}`;
    if (used + line.length > TOTAL_BUDGET) break;
    includedSummaries.unshift(line);
    used += line.length;
  }
  const omittedTitles = ordered
    .filter((n) => !includedSummaries.some((s) => s.includes(fmt(n))))
    .map((n) => `  - ${fmt(n)}`);

  const block = `PRIOR SECTIONS ALREADY DRAFTED (do NOT repeat their content; build on them)
${includedSummaries.join("\n\n")}${omittedTitles.length ? `\n\nOther earlier sections already drafted (titles only — assume their content exists; do not repeat):\n${omittedTitles.join("\n")}` : ""}`;

  return { block, allNodes: arr };
}

export function buildUpcomingSectionsBlock(opts: {
  allNodes: OutlineNodeLite[];
  currentNodeId: string;
  currentSortOrder: number;
}): string {
  const upcoming = opts.allNodes
    .filter((n) => n.id !== opts.currentNodeId && n.sort_order > opts.currentSortOrder)
    .sort((a, b) => a.sort_order - b.sort_order)
    .slice(0, 12);
  if (upcoming.length === 0) {
    return `UPCOMING SECTIONS (titles only — do NOT write their content or encroach on their scope)
(none — this is the last section)`;
  }
  return `UPCOMING SECTIONS (titles only — do NOT write their content or encroach on their scope)
${upcoming.map((n) => `  - ${fmt(n)}`).join("\n")}`;
}

export const NO_TRANSITION_RULE =
  `TRANSITIONS:\n- End this section cleanly on its own substantive last sentence. Do NOT write forward-pointing transitions, "in the next section..." phrasing, or hand-off sentences. The next section will stand on its own.`;
