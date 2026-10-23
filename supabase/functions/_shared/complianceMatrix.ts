// Pure logic for the compliance matrix: reading imported matrices, matching
// them to extracted requirements, merging re-extractions safely, classifying
// post-award clauses and batching source sections for extraction.
//
// No imports and no Deno or browser globals, so it runs in edge functions, the
// frontend and Vitest.
//
// Model:
// - A "master" requirement is a row from an imported matrix (origin "import").
// - Detailed AI-extracted requirements that fall under a master are linked to it
//   with covered_by_id. They are never deleted or rewritten, so outline links
//   and [Req-X] citations keep working.

// ---------------------------------------------------------------------------
// Types

export type DocKind = "pws" | "solicitation" | "wage_determination";

export type WorkflowStatus =
  | "not_started"
  | "drafted"
  | "pending_customer"
  | "pending_government"
  | "pending_pricing"
  | "final_review"
  | "ready";

export type Criticality = "high" | "medium" | "low";
export type Applicability = "proposal" | "post_award";

export interface RefKey {
  kind: "pws" | "te" | "clause" | "instruction";
  /** pws: "1.6.7.3.1"; te: "2"; clause: "52.219-14"; instruction: "c.3.a" */
  value: string;
  /** pws ranges such as 5.1.4.4-5.1.4.5 */
  end?: string;
  /** A broad match (e.g. "Proposal Instructions" = the 52.212-1 addendum) that also needs similar wording. */
  loose?: boolean;
}

export interface ImportRow {
  external_id: string;
  area: string;
  requirement_type: string;
  reference: string;
  text: string;
  proposal_location: string;
  response_evidence: string;
  workflow_status: WorkflowStatus;
  action_needed: string;
  needs_clarification: boolean;
  criticality: Criticality | null;
  owner: string;
  verified: boolean;
  source_document: string;
  applicability: Applicability;
}

export interface ExistingItem {
  id: string;
  req_number: string | null;
  shall_text: string | null;
  source_section: string | null;
  doc_kind: DocKind | null;
  origin: "ai" | "import" | "manual" | null;
  external_id: string | null;
  covered_by_id: string | null;
}

// ---------------------------------------------------------------------------
// Small helpers

const clean = (s: unknown): string => (s == null ? "" : String(s)).replace(/\s+/g, " ").trim();

export function docKindFromFileName(name: string | null | undefined): DocKind {
  const n = (name ?? "").toLowerCase();
  if (/wage ?determination|\bwd[ _-]?\d/.test(n)) return "wage_determination";
  if (/performance work statement|\bpws\b|statement of work|\bsow\b|statement of objectives|\bsoo\b/.test(n)) return "pws";
  return "solicitation";
}

/** Compare dotted section numbers numerically: "1.10" > "1.9". */
function cmpSection(a: string, b: string): number {
  const pa = a.split(".").map((x) => parseInt(x, 10));
  const pb = b.split(".").map((x) => parseInt(x, 10));
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const x = pa[i] ?? -1, y = pb[i] ?? -1;
    if (x !== y) return x - y;
  }
  return 0;
}

const STOP = new Set(("the a an and or of to in for on by with be is are shall must will that this as at from all any each its their than within per not no " +
  "am pm est edt et cst pst january february march april may june july august september october november december").split(" "));
/** Meaningful words only: numbers, dates and times are ignored, so two deadlines don't look alike. */
function tokens(s: string): Set<string> {
  return new Set(clean(s).toLowerCase().replace(/[^a-z0-9\s]/g, " ").split(/\s+/).filter((t) => t.length > 1 && !/\d/.test(t) && !STOP.has(t)));
}

/** Number of meaningful words two texts share. */
export function sharedWords(a: string | null | undefined, b: string | null | undefined): number {
  const A = tokens(a ?? ""), B = tokens(b ?? "");
  let hit = 0;
  for (const t of A) if (B.has(t)) hit++;
  return hit;
}

/** Overlap of meaningful words, 0–1 (share of the smaller text's words found in the other). */
export function textSimilarity(a: string | null | undefined, b: string | null | undefined): number {
  const A = tokens(a ?? ""), B = tokens(b ?? "");
  if (!A.size || !B.size) return 0;
  let hit = 0;
  for (const t of A) if (B.has(t)) hit++;
  // One shared word is coincidence ("proposal"), unless a text has only one word.
  if (hit < Math.min(2, A.size, B.size)) return 0;
  return hit / Math.min(A.size, B.size);
}

// ---------------------------------------------------------------------------
// References

/**
 * Clauses that hold a whole section of the solicitation (instructions,
 * evaluation, reps and certs, terms). Naming one says little about which
 * requirement is meant, so matches through them also need similar wording.
 */
const CONTAINER_CLAUSES = new Set(["52.212-1", "52.212-2", "52.212-3", "52.212-4", "52.212-5"]);

/** Parse a matrix reference such as "PWS 5.1.4.4-5.1.4.5; TE2", "FAR 52.219-14" or "Proposal Instructions C.3.b(ii)". */
export function parseReference(ref: string | null | undefined): RefKey[] {
  const r = clean(ref);
  const keys: RefKey[] = [];
  for (const m of r.matchAll(/PWS\s*(?:Paragraph\s*)?(\d+(?:\.\d+)*)(?:\s*[-\u2013]\s*(\d+(?:\.\d+)*))?/gi)) {
    keys.push({ kind: "pws", value: m[1], ...(m[2] ? { end: m[2] } : {}) });
  }
  // Extra PWS numbers in lists like "PWS 1.7.2; 5.3.1.3; 5.4.1.1" or "5.5.1.9.4 & 5.5.1.9.6"
  if (/PWS/i.test(r)) {
    for (const m of r.matchAll(/(?:[;&,]|\band\b)\s*(\d+\.\d+(?:\.\d+)*)/g)) {
      if (!keys.some((k) => k.kind === "pws" && k.value === m[1])) keys.push({ kind: "pws", value: m[1] });
    }
  }
  for (const m of r.matchAll(/\bTE\s*(\d)\b/gi)) keys.push({ kind: "te", value: m[1] });
  for (const m of r.matchAll(/\b(?:FAR|DFARS)?\s*((?:52|252)\.\d{3}-\d{1,4})\b/g)) {
    if (!keys.some((k) => k.kind === "clause" && k.value === m[1])) {
      keys.push({ kind: "clause", value: m[1], ...(CONTAINER_CLAUSES.has(m[1]) ? { loose: true } : {}) });
    }
  }
  for (const m of r.matchAll(/(?:Proposal|General)\s+Instructions\s+([A-Z])\.(\d+)(?:\.([a-z]))?/g)) {
    keys.push({ kind: "instruction", value: [m[1], m[2], m[3]].filter(Boolean).join(".").toLowerCase() });
  }
  // "Addendum 52.212-1 A.5" or "Addendum A.6" → addendum paragraph a.5
  for (const m of r.matchAll(/Addendum[^;]*?\b([A-Z])\.(\d+)\b/g)) {
    const value = `${m[1]}.${m[2]}`.toLowerCase();
    if (!keys.some((k) => k.kind === "instruction" && k.value === value)) keys.push({ kind: "instruction", value });
  }
  // Instructions and the addendum live in the FAR 52.212-1 addendum; evaluation in 52.212-2.
  // These broad keys only match when the wording is also similar.
  if (/(Proposal|General)\s+Instructions|Addendum/i.test(r) && !keys.some((k) => k.kind === "clause" && k.value === "52.212-1")) {
    keys.push({ kind: "clause", value: "52.212-1", loose: true });
  }
  if (/Evaluation/i.test(r) && !keys.some((k) => k.kind === "clause" && k.value === "52.212-2")) {
    keys.push({ kind: "clause", value: "52.212-2", loose: true });
  }
  return keys;
}

/** Keys describing where an extracted item came from. */
export function itemKeys(item: Pick<ExistingItem, "source_section" | "doc_kind">): RefKey[] {
  const s = clean(item.source_section);
  const keys: RefKey[] = [];
  if (item.doc_kind === "pws") {
    const m = /^(?:C\.)?(\d+(?:\.\d+)*)/i.exec(s);
    if (m) keys.push({ kind: "pws", value: m[1] });
  }
  for (const m of s.matchAll(/((?:52|252)\.\d{3}-\d{1,4})/g)) keys.push({ kind: "clause", value: m[1] });
  if (item.doc_kind !== "pws") {
    // Instruction labels such as "C.3.b.ii", "C.2.a", "C.6"
    const ins = /^([A-Z])\.(\d+)(?:\.([a-z]))?\b/.exec(s);
    if (ins) keys.push({ kind: "instruction", value: [ins[1], ins[2], ins[3]].filter(Boolean).join(".").toLowerCase() });
    // Addendum paragraphs: "Addendum to 52.212-1, A.4" or "Addendum to FAR 52.212-1, Para 4"
    const add = /Addendum.*?(?:\b([A-Z])\.(\d+)\b|Para\.?\s*(\d+))/i.exec(s);
    if (add) keys.push({ kind: "instruction", value: add[1] ? `${add[1]}.${add[2]}`.toLowerCase() : `a.${add[3]}` });
  }
  return keys;
}

/** Does a matrix reference key cover an item key? Sections include their sub-sections. */
export function refCovers(ref: RefKey, item: RefKey): boolean {
  if (ref.kind !== item.kind) return false;
  if (ref.kind === "clause") return ref.value === item.value;
  if (ref.kind === "instruction") return item.value === ref.value || item.value.startsWith(ref.value + ".");
  if (ref.kind !== "pws") return false;
  const v = item.value;
  if (ref.end) {
    const head = v.split(".").slice(0, ref.value.split(".").length).join(".");
    return cmpSection(head, ref.value) >= 0 && (cmpSection(head, ref.end) <= 0 || v.startsWith(ref.end + "."));
  }
  return v === ref.value || v.startsWith(ref.value + ".");
}

// ---------------------------------------------------------------------------
// Classification

const POST_AWARD_PATTERNS: RegExp[] = [
  /\bWAWF\b|wide area workflow|payment request|receiving report|invoice/i,
  /252\.232-7006/,
  /252\.243-7002|request for equitable adjustment|equitable adjustment/i,
  /52\.217-[89]\b|option to extend|exercises? this option/i,
  /joint venture/i,
  /independent contractor shall be considered a subcontractor/i,
  /50 percent limitation shall apply only to the supply portion/i,
];

/** Proposal requirement, or a contract term that only matters after award. */
export function classifyApplicability(text: string | null | undefined, section?: string | null): Applicability {
  const t = `${clean(text)} ${clean(section)}`;
  return POST_AWARD_PATTERNS.some((re) => re.test(t)) ? "post_award" : "proposal";
}

// ---------------------------------------------------------------------------
// Spreadsheet rows → import rows

const COLUMN_ALIASES: Record<keyof ImportRow, RegExp> = {
  external_id: /^(id|req(uirement)?\s*(id|#|no\.?|number))$/i,
  area: /^(area|category|volume|section group)$/i,
  requirement_type: /^(requirement\s*type|type)$/i,
  reference: /^(reference|ref|source\s*(ref(erence)?|section)|solicitation\s*ref(erence)?)$/i,
  text: /^(requirement(\s*\/\s*instruction)?|requirement text|instruction|shall statement|description)$/i,
  proposal_location: /^(proposal\s*(location|section)|response\s*location|volume\s*\/\s*section)$/i,
  response_evidence: /^(required\s*response(\s*\/\s*evidence)?|evidence|response)$/i,
  workflow_status: /^(status)$/i,
  action_needed: /^(information\s*needed(\s*\/\s*action)?|action(\s*needed)?|notes?)$/i,
  needs_clarification: /^(gov(ernment)?\.?\s*clarification\??|clarification( needed)?\??)$/i,
  criticality: /^(criticality|priority|risk)$/i,
  owner: /^(owner|assigned to|responsible)$/i,
  verified: /^(final\s*verified|verified)$/i,
  source_document: /^(source\s*document|document|source)$/i,
  applicability: /^(applicability)$/i,
};

/** Index of the header row: the first row with a requirement-text column and an ID column. */
export function findHeaderRow(rows: unknown[][]): number {
  for (let i = 0; i < Math.min(rows.length, 25); i++) {
    const cells = (rows[i] ?? []).map(clean);
    if (cells.some((c) => COLUMN_ALIASES.text.test(c)) && cells.some((c) => COLUMN_ALIASES.external_id.test(c))) return i;
  }
  return -1;
}

export function mapColumns(header: unknown[]): Partial<Record<keyof ImportRow, number>> {
  const map: Partial<Record<keyof ImportRow, number>> = {};
  header.map(clean).forEach((cell, i) => {
    for (const [key, re] of Object.entries(COLUMN_ALIASES) as Array<[keyof ImportRow, RegExp]>) {
      if (map[key] === undefined && re.test(cell)) { map[key] = i; break; }
    }
  });
  return map;
}

export function normalizeWorkflowStatus(s: unknown): WorkflowStatus {
  const v = clean(s).toLowerCase();
  if (!v) return "not_started";
  if (/ready|complete|done|compliant/.test(v)) return "ready";
  if (/final/.test(v)) return "final_review";
  if (/pricing/.test(v)) return "pending_pricing";
  if (/gov/.test(v)) return "pending_government";
  if (/customer|client/.test(v)) return "pending_customer";
  if (/draft|in progress|writing/.test(v)) return "drafted";
  return "not_started";
}

export function normalizeCriticality(s: unknown): Criticality | null {
  const v = clean(s).toLowerCase();
  if (/^(high|critical|h)$/.test(v)) return "high";
  if (/^(medium|med|m|moderate)$/.test(v)) return "medium";
  if (/^(low|l)$/.test(v)) return "low";
  return null;
}

const yes = (s: unknown) => /^(y|yes|true|x|✓|✔)$/i.test(clean(s));

export interface ParseResult {
  rows: ImportRow[];
  skipped: number;
  columns: Partial<Record<keyof ImportRow, number>>;
  error?: string;
}

/** Turn a sheet (array of rows of cells) into import rows. */
export function parseMatrixSheet(sheet: unknown[][]): ParseResult {
  const h = findHeaderRow(sheet);
  if (h < 0) return { rows: [], skipped: 0, columns: {}, error: "No header row with an ID and a Requirement column was found." };
  const cols = mapColumns(sheet[h]);
  const get = (r: unknown[], k: keyof ImportRow) => (cols[k] === undefined ? "" : clean(r[cols[k]!]));
  const rows: ImportRow[] = [];
  let skipped = 0;
  const seen = new Set<string>();
  for (const r of sheet.slice(h + 1)) {
    const id = get(r, "external_id");
    const text = get(r, "text");
    if (!id || !text || seen.has(id)) { if (r.some((c) => clean(c))) skipped++; continue; }
    seen.add(id);
    const area = get(r, "area");
    const type = get(r, "requirement_type");
    const reference = get(r, "reference");
    rows.push({
      external_id: id.slice(0, 40),
      area,
      requirement_type: type,
      reference,
      text: text.slice(0, 4000),
      proposal_location: get(r, "proposal_location"),
      response_evidence: get(r, "response_evidence"),
      workflow_status: normalizeWorkflowStatus(get(r, "workflow_status")),
      action_needed: get(r, "action_needed"),
      needs_clarification: yes(get(r, "needs_clarification")),
      criticality: normalizeCriticality(get(r, "criticality")),
      owner: get(r, "owner"),
      verified: !!get(r, "verified") && !/^(no|n|false)$/i.test(get(r, "verified")),
      source_document: get(r, "source_document"),
      applicability: /post[- ]award/i.test(area) || /post[- ]award/i.test(type) ? "post_award" : "proposal",
    });
  }
  return { rows, skipped, columns: cols };
}

// ---------------------------------------------------------------------------
// Import plan

/** Wording overlap at which two items are the same requirement whatever their labels. */
export const SAME_TEXT_SIMILARITY = 0.95;

/** Minimum wording overlap for a broad (loose) reference match. */
export const LOOSE_MIN_SIMILARITY = 0.45;
/** Instruction paragraphs hold several rows, so a match there also needs some shared wording. */
export const INSTRUCTION_MIN_SIMILARITY = 0.3;

/** A broad match must score within this of the row's best broad match. */
export const LOOSE_RELATIVE_GAP = 0.3;

export interface ImportPlan {
  /** New master rows to insert. */
  inserts: ImportRow[];
  /** Master rows that already exist (same external_id) and are refreshed. */
  updates: Array<{ id: string; row: ImportRow }>;
  /** Existing detailed items that fall under a master row. */
  cover: Array<{ itemId: string; externalId: string }>;
  /** AI items not covered by any master row. */
  uncovered: string[];
}

/**
 * Plan an import: every spreadsheet row becomes (or refreshes) a master
 * requirement; existing AI items whose source section or clause the row's
 * reference covers are linked under it. When several rows cover the same item,
 * the most specific reference wins, then the most similar text.
 */
export function planImport(rows: ImportRow[], existing: ExistingItem[]): ImportPlan {
  const byExternal = new Map(existing.filter((e) => e.external_id).map((e) => [e.external_id!, e]));
  const inserts: ImportRow[] = [];
  const updates: ImportPlan["updates"] = [];
  for (const row of rows) {
    const prior = byExternal.get(row.external_id);
    if (prior) updates.push({ id: prior.id, row });
    else inserts.push(row);
  }

  const details = existing.filter((e) => e.origin !== "import");
  const rowKeys = rows.map((r) => ({ r, keys: parseReference(r.reference) }));
  const cover: ImportPlan["cover"] = [];
  const uncovered: string[] = [];
  for (const item of details) {
    const ik = itemKeys(item);
    let best: { id: string; spec: number; sim: number; words: number } | null = null;
    for (const { r, keys } of rowKeys) {
      for (const k of keys) {
        for (const i of ik) {
          if (!refCovers(k, i)) continue;
          const sim = textSimilarity(r.text, item.shall_text);
          if (k.loose && sim < LOOSE_MIN_SIMILARITY) continue;
          if (k.kind === "instruction" && sim < INSTRUCTION_MIN_SIMILARITY) continue;
          const spec = k.loose ? 50 : k.kind === "clause" ? 99 : k.kind === "instruction" ? 60 + k.value.split(".").length : k.value.split(".").length - (k.end ? 0.5 : 0);
          const words = sharedWords(r.text, item.shall_text);
          // Same specificity: prefer the row sharing more words (a very short row can
          // score a high percentage from two common words), then the higher percentage.
          const better = !best || spec > best.spec ||
            (spec === best.spec && (words > best.words || (words === best.words && sim > best.sim)));
          if (better) best = { id: r.external_id, spec, sim, words };
        }
      }
    }
    if (best) cover.push({ itemId: item.id, externalId: best.id, sim: best.sim, loose: best.spec === 50 } as ImportPlan["cover"][number] & { sim: number; loose: boolean });
    else uncovered.push(item.id);
  }
  // A broad match is kept only if it is close to that row's best broad match.
  const tagged = cover as Array<ImportPlan["cover"][number] & { sim: number; loose: boolean }>;
  const bestLoose = new Map<string, number>();
  for (const c of tagged) if (c.loose) bestLoose.set(c.externalId, Math.max(bestLoose.get(c.externalId) ?? 0, c.sim));
  const kept: ImportPlan["cover"] = [];
  for (const c of tagged) {
    if (c.loose && c.sim < (bestLoose.get(c.externalId) ?? 0) - LOOSE_RELATIVE_GAP) uncovered.push(c.itemId);
    else kept.push({ itemId: c.itemId, externalId: c.externalId });
  }
  return { inserts, updates, cover: kept, uncovered };
}

// ---------------------------------------------------------------------------
// Re-extraction merge

export interface ExtractedItem {
  req_number: string;
  shall_text: string;
  source_section: string | null;
  doc_kind: DocKind | null;
}

export interface MergeResult<T extends ExtractedItem> {
  /** New items to insert, with the master they fall under (if any). */
  inserts: Array<T & { cover_external_id: string | null }>;
  /** Items skipped because the same requirement already exists. */
  duplicates: T[];
}

/**
 * Merge a fresh extraction into what already exists, without deleting or
 * rewriting anything: an item is a duplicate when an existing item from the
 * same section (or with no section) says the same thing; new items under a
 * master row's reference are linked to that master.
 */
export function mergeExtracted<T extends ExtractedItem>(existing: ExistingItem[], masters: ImportRow[], incoming: T[], threshold = 0.8): MergeResult<T> {
  const inserts: MergeResult<T>["inserts"] = [];
  const duplicates: T[] = [];
  const pool = existing.filter((e) => e.origin !== "import").map((e) => ({ sec: normSection(e.source_section), text: e.shall_text ?? "" }));
  const masterKeys = masters.map((m) => ({ id: m.external_id, text: m.text, keys: parseReference(m.reference) }));
  for (const item of incoming) {
    const sec = normSection(item.source_section);
    const dup = pool.some((p) => {
      const sim = textSimilarity(p.text, item.shall_text);
      // Same requirement under a different label ("Para 4" vs "A.4") is still a duplicate.
      return sim >= SAME_TEXT_SIMILARITY || ((p.sec === sec || !p.sec || !sec) && sim >= threshold);
    });
    if (dup) { duplicates.push(item); continue; }
    pool.push({ sec, text: item.shall_text });
    const ik = itemKeys({ source_section: item.source_section, doc_kind: item.doc_kind });
    let cover: { id: string; spec: number } | null = null;
    for (const m of masterKeys) for (const k of m.keys) for (const i of ik) {
      if (!refCovers(k, i)) continue;
      if (k.loose && textSimilarity(m.text, item.shall_text) < LOOSE_MIN_SIMILARITY) continue;
      const spec = k.loose ? 50 : k.kind === "clause" ? 99 : k.value.split(".").length;
      if (!cover || spec > cover.spec) cover = { id: m.id, spec };
    }
    inserts.push({ ...item, cover_external_id: cover?.id ?? null });
  }
  return { inserts, duplicates };
}

function normSection(s: string | null | undefined): string {
  return clean(s).toLowerCase().replace(/^c\./, "").replace(/\s+/g, "");
}

// ---------------------------------------------------------------------------
// Extraction batching

export interface SourceSection {
  document_id: string;
  file_name: string;
  section_number: string | null;
  section_title: string | null;
  content: string | null;
  page_start: number | null;
}

const BINDING_RE = /\b(shall|must|will|is required to|are required to|is responsible for|are responsible for|offerors? (?:should|are to)|no later than|NLT)\b/i;
const ALWAYS_INCLUDE_RE = /technical exhibit|performance requirements summary|\bPRS\b|deliverables?|workload|instructions? to offerors|evaluation|page limit|proposal (?:preparation|instructions|format)/i;

/** Sections that can contain requirements: binding language, or titles like PRS, deliverables, evaluation and instructions. */
export function isRequirementSection(s: Pick<SourceSection, "section_title" | "content">): boolean {
  return BINDING_RE.test(s.content ?? "") || ALWAYS_INCLUDE_RE.test(`${s.section_title ?? ""} ${(s.content ?? "").slice(0, 200)}`);
}

/**
 * Split every requirement-bearing section into batches of about `maxChars`,
 * keeping document order. Nothing is dropped: a long section is split across
 * blocks instead of being cut off.
 */
export function batchSections(sections: SourceSection[], maxChars = 16_000, perBlockMax = 6_000): string[][] {
  const batches: string[][] = [];
  let current: string[] = [];
  let size = 0;
  const push = (block: string) => {
    if (size + block.length > maxChars && current.length) { batches.push(current); current = []; size = 0; }
    current.push(block);
    size += block.length;
  };
  for (const s of sections) {
    if (!isRequirementSection(s)) continue;
    const body = clean(s.content);
    if (!body) continue;
    const head = `[${s.file_name} | ${s.section_number ?? "?"} ${s.section_title ?? ""} | p.${s.page_start ?? "?"}]`;
    for (let i = 0; i < body.length; i += perBlockMax) {
      const part = body.slice(i, i + perBlockMax);
      push(`${head}${i ? " (continued)" : ""}\n${part}`);
    }
  }
  if (current.length) batches.push(current);
  return batches;
}
