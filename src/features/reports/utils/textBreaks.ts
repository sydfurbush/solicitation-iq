// Helpers to introduce wrap opportunities in long unbreakable tokens
// (e.g. filenames joined with "+", "_", "/", ".", "-").

const BREAK_CHARS = /([+_/\\.\-&;,:|§#=])/g;

/** Insert zero-width spaces after break chars in long tokens. For Word/HTML. */
export function softBreakWord(input: string | null | undefined, threshold = 12): string {
  if (!input) return "";
  return input
    .split(/(\s+)/)
    .map((tok) => (tok.length > threshold ? tok.replace(BREAK_CHARS, "$1\u200B") : tok))
    .join("");
}

/** Insert real spaces after break chars in long tokens, so jsPDF splitTextToSize can wrap. */
export function hardBreakWord(input: string | null | undefined, threshold = 12): string {
  if (!input) return "";
  return input
    .split(/(\s+)/)
    .map((tok) => (tok.length > threshold ? tok.replace(BREAK_CHARS, "$1 ") : tok))
    .join("");
}
