export interface ParsedCitation {
  section?: string;
  page?: number;
}

const SECTION_RE = /(?:section\s+)?([A-Z]?\.?\d+(?:\.\d+)*)/i;
const PAGE_RE = /page\s*(\d+)/i;

export function parseCitation(text: string): ParsedCitation {
  if (!text) return {};
  const sectionMatch = text.match(SECTION_RE);
  const pageMatch = text.match(PAGE_RE);
  return {
    section: sectionMatch?.[1],
    page: pageMatch ? Number(pageMatch[1]) : undefined,
  };
}

export function formatCitation(opts: {
  document?: string;
  section?: string;
  page?: number | null;
}): string {
  const parts: string[] = [];
  if (opts.section) parts.push(`Section ${opts.section}`);
  if (opts.page != null) parts.push(`Page ${opts.page}`);
  const main = parts.join(", ");
  if (!opts.document) return main || "Unknown source";
  return main ? `${main} — ${opts.document}` : opts.document;
}

export function linkCitationToSection<T extends { section_number?: string | null; id: string }>(
  citation: ParsedCitation,
  sections: T[]
): T | undefined {
  if (!citation.section) return undefined;
  return sections.find((s) => s.section_number === citation.section);
}
