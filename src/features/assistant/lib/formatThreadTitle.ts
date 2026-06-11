/**
 * Strip markdown syntax from a raw user message so it renders cleanly
 * as a thread title in the sidebar.
 */
export function formatThreadTitle(raw: string | null | undefined, max = 60): string {
  if (!raw) return "New chat";
  let s = String(raw);

  // Remove fenced code blocks entirely, keep inner text
  s = s.replace(/```[a-zA-Z0-9_-]*\s*/g, " ");
  // Remove stray backticks
  s = s.replace(/`+/g, "");
  // Strip leading "prompt" / "markdown" / "text" language labels left over
  s = s.replace(/^\s*(prompt|markdown|md|text|plaintext)\b[:\-]?\s*/i, "");
  // Strip heading hashes, blockquotes, list bullets at line starts
  s = s.replace(/^\s*#{1,6}\s+/gm, "");
  s = s.replace(/^\s*>+\s?/gm, "");
  s = s.replace(/^\s*(?:[-*+]|\d+\.)\s+/gm, "");
  // Strip bold / italic / strike markers
  s = s.replace(/\*\*|__|~~/g, "");
  s = s.replace(/(^|[\s(])[*_]([^*_\n]+)[*_](?=[\s).,!?;:]|$)/g, "$1$2");
  // Links: [text](url) -> text
  s = s.replace(/\[([^\]]+)\]\([^)]*\)/g, "$1");
  // Collapse whitespace
  s = s.replace(/\s+/g, " ").trim();

  if (!s) return "New chat";
  return s.length > max ? s.slice(0, max).trimEnd() : s;
}
