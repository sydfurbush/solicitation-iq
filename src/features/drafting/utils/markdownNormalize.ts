// Unwraps soft line breaks introduced by hard-wrapped Markdown (~80 cols)
// while preserving real structure: blank-line paragraph breaks, fenced code,
// tables, headings, blockquotes, and list items (with their continuation lines).

const LIST_RE = /^(\s*)([-*+]|\d+[.)])\s+/;
const HEADING_RE = /^\s{0,3}#{1,6}\s/;
const BLOCKQUOTE_RE = /^\s{0,3}>/;
const TABLE_RE = /^\s*\|.*\|\s*$/;
const HR_RE = /^\s{0,3}(-{3,}|\*{3,}|_{3,})\s*$/;
const FENCE_RE = /^\s{0,3}(```|~~~)/;

function isStructural(line: string): boolean {
  return (
    HEADING_RE.test(line) ||
    BLOCKQUOTE_RE.test(line) ||
    TABLE_RE.test(line) ||
    HR_RE.test(line) ||
    LIST_RE.test(line)
  );
}

/**
 * Detects whether a markdown string appears to be hard-wrapped at a fixed
 * column width (a strong hint that an LLM produced ~80-col line breaks).
 */
export function looksHardWrapped(md: string): boolean {
  const lines = md.split("\n").filter((l) => l.trim().length > 0);
  if (lines.length < 6) return false;
  const wrapped = lines.filter((l) => l.length > 40 && l.length < 95 && !isStructural(l));
  return wrapped.length / lines.length > 0.5;
}

/**
 * Collapse single newlines inside paragraphs and list items to spaces.
 * Preserve blank-line paragraph breaks, fenced code blocks, tables, headings,
 * blockquotes, horizontal rules, and list-item boundaries.
 */
export function unwrapSoftBreaks(md: string): string {
  if (!md) return md;
  const lines = md.split("\n");
  const out: string[] = [];
  let inFence = false;
  let buffer: string[] = [];

  const flush = () => {
    if (buffer.length === 0) return;
    out.push(buffer.join(" ").replace(/\s+/g, " ").trimEnd());
    buffer = [];
  };

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    if (FENCE_RE.test(line)) {
      flush();
      out.push(line);
      inFence = !inFence;
      continue;
    }
    if (inFence) {
      out.push(line);
      continue;
    }

    // Blank line = paragraph break
    if (line.trim() === "") {
      flush();
      out.push("");
      continue;
    }

    // Structural lines that must stand alone (headings, tables, hr, blockquote)
    if (
      HEADING_RE.test(line) ||
      TABLE_RE.test(line) ||
      HR_RE.test(line) ||
      BLOCKQUOTE_RE.test(line)
    ) {
      flush();
      out.push(line.trimEnd());
      continue;
    }

    // List item starts -> flush previous, start new buffer with this line
    if (LIST_RE.test(line)) {
      flush();
      buffer.push(line.trimEnd());
      continue;
    }

    // Continuation of paragraph or current list item
    buffer.push(line.trim());
  }
  flush();

  // Collapse 3+ blank lines down to a single blank line
  return out.join("\n").replace(/\n{3,}/g, "\n\n").trimEnd() + "\n";
}

/**
 * Convenience: normalize only when the content looks hard-wrapped, otherwise
 * return the input unchanged so user-authored Markdown is preserved as-is.
 */
export function normalizeIfWrapped(md: string): string {
  return looksHardWrapped(md) ? unwrapSoftBreaks(md) : md;
}
