// Pure helpers for linking requirements to outline sections and tracking
// [Req-X] citations in draft text.
//
// No imports and no Deno or browser globals, so this file can be used from
// edge functions (Deno), from the frontend (Vite), and from Vitest.

export interface RequirementRef {
  id: string;
  req_number: string | null;
}

export interface RequirementForPrompt {
  req_number: string | null;
  source_section: string | null;
  shall_text: string | null;
}

/**
 * Canonical form of a requirement number so that "C-1.1", "c.1.1",
 * "[Req-C-1.1]", "Req C-1.1" and "C–1.1" (en dash) all compare equal.
 */
export function normalizeReqNumber(raw: string | null | undefined): string {
  let s = (raw ?? "").trim().toLowerCase();
  s = s.replace(/^\\?\[/, "").replace(/\\?\]$/, ""); // surrounding [ ] (optionally escaped)
  s = s.replace(/^(?:req(?:uirement)?[\s\-_:#]*)+/, ""); // leading "Req-", "Req ", "requirement #" (repeated)
  s = s.replace(/[\u2010-\u2015]/g, "-"); // unicode dashes → hyphen
  s = s.replace(/\s+/g, "");
  s = s.replace(/[-_.]+/g, "."); // treat - _ . as the same separator
  return s.replace(/^\.+|\.+$/g, "");
}

/** Map of normalized requirement number → requirement id. First one wins on collision. */
export function buildReqIndex(requirements: RequirementRef[]): Map<string, string> {
  const index = new Map<string, string>();
  for (const r of requirements) {
    const key = normalizeReqNumber(r.req_number);
    if (key && !index.has(key)) index.set(key, r.id);
  }
  return index;
}

/**
 * Turn the AI's comma/space separated list of requirement numbers into
 * requirement ids. Tolerates separator, case and bracket differences.
 * Returns unique ids in first-seen order, plus the refs it could not match.
 */
export function resolveRequirementRefs(
  refs: string | null | undefined,
  index: Map<string, string>,
): { ids: string[]; unmatched: string[] } {
  const ids: string[] = [];
  const unmatched: string[] = [];
  const seen = new Set<string>();
  const tokens = (refs ?? "").split(/[,;\s]+/).map((t) => t.trim()).filter(Boolean);
  for (const token of tokens) {
    const id = index.get(normalizeReqNumber(token));
    if (!id) {
      unmatched.push(token);
    } else if (!seen.has(id)) {
      seen.add(id);
      ids.push(id);
    }
  }
  return { ids, unmatched };
}

/** Requirements that are not linked to any outline node. */
export function findUnplacedRequirements<T extends RequirementRef>(
  requirements: T[],
  linkedIdsPerNode: Array<string[] | null | undefined>,
): T[] {
  const linked = new Set<string>();
  for (const ids of linkedIdsPerNode) for (const id of ids ?? []) linked.add(id);
  return requirements.filter((r) => !linked.has(r.id));
}

/**
 * Build the requirement list for the outline prompt. Every requirement is
 * included (the old version silently dropped everything after the first 200);
 * the per-requirement text is shortened as the list grows so the block stays
 * within roughly `budgetChars`.
 */
export function buildRequirementPromptList(
  requirements: RequirementForPrompt[],
  budgetChars = 60_000,
): string {
  if (!requirements.length) return "";
  const perLineOverhead = 40; // req number, section and brackets
  const perReq = Math.floor(budgetChars / requirements.length) - perLineOverhead;
  const textLimit = Math.max(60, Math.min(240, perReq));
  return requirements
    .map((r) => {
      const text = (r.shall_text ?? "").replace(/\s+/g, " ").trim();
      const clipped = text.length > textLimit ? `${text.slice(0, textLimit - 1)}…` : text;
      return `${r.req_number ?? "?"} [${r.source_section ?? "?"}] ${clipped}`;
    })
    .join("\n");
}

// Matches [Req-C-1.1], \[Req-C-1.1\], [REQ C.1.1], [req-c-1.1] …
const REQ_TAG_RE = /\\?\[\s*req(?:uirement)?[\s\-_:#]*([A-Za-z0-9][A-Za-z0-9.\-_\u2010-\u2015]*)\s*\\?\]/gi;
// Matches [K1], \[K12\]
const K_TAG_RE = /\\?\[\s*K\d+\s*\\?\]/g;

/** Normalized requirement numbers cited anywhere in the text. */
export function extractCitedReqNumbers(text: string | null | undefined): Set<string> {
  const out = new Set<string>();
  for (const m of (text ?? "").matchAll(REQ_TAG_RE)) out.add(normalizeReqNumber(m[1]));
  return out;
}

/** True when the text cites the requirement with a [Req-X] tag (tolerant of case and separators). */
export function isRequirementCited(text: string | null | undefined, reqNumber: string | null | undefined): boolean {
  const key = normalizeReqNumber(reqNumber);
  return !!key && extractCitedReqNumbers(text).has(key);
}

/** Requirement numbers from `reqNumbers` that the text does not cite. */
export function findUncitedRequirements(text: string | null | undefined, reqNumbers: Array<string | null>): string[] {
  const cited = extractCitedReqNumbers(text);
  return reqNumbers.filter((n): n is string => !!n && !cited.has(normalizeReqNumber(n)));
}

/**
 * Remove internal [Req-X] and [K#] tags from text going into a submission
 * document, and tidy the spacing they leave behind.
 */
export function stripCitationTags(text: string | null | undefined): string {
  return (text ?? "")
    .replace(REQ_TAG_RE, "")
    .replace(K_TAG_RE, "")
    .replace(/\(\s*\)/g, "")
    .replace(/[ \t]{2,}/g, " ")
    .replace(/ +([.,;:!?)])/g, "$1")
    .replace(/[ \t]+$/gm, "");
}
