// Copy a markdown string as rich HTML so pasting into Word/Outlook keeps formatting.
// Falls back to plain text on older browsers.

import { marked } from "marked";

export async function copyRich(markdownText: string): Promise<boolean> {
  const html = await marked.parse(markdownText, { async: true });
  try {
    if (typeof ClipboardItem !== "undefined" && navigator.clipboard?.write) {
      const blobHtml = new Blob([String(html)], { type: "text/html" });
      const blobText = new Blob([markdownText], { type: "text/plain" });
      await navigator.clipboard.write([
        new ClipboardItem({ "text/html": blobHtml, "text/plain": blobText }),
      ]);
      return true;
    }
  } catch {
    /* fall through to text */
  }
  await navigator.clipboard.writeText(markdownText);
  return true;
}

export async function copyPlain(text: string) {
  await navigator.clipboard.writeText(text);
}
