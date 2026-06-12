import { useState } from "react";
import { FileDown, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "@/hooks/use-toast";
import {
  createPdf,
  drawHeader,
  writeWrapped,
  drawTable,
  savePdf,
  FONT,
  MARGINS,
  CONTENT_WIDTH,
  PALETTE,
  LETTER,
} from "@/lib/pdf/pdfKit";
import type { AssistantMessage, AssistantThread } from "../hooks/useAssistantThreads";

type Props = {
  message: AssistantMessage;
  thread?: AssistantThread | null;
};

/** Strip inline markdown emphasis/code markers — we render plain text per
 *  product decision (no inline bold/italic in the PDF). */
function stripInlineMd(s: string): string {
  let out = s;
  // bold/italic: **text**, __text__, *text*, _text_
  out = out.replace(/\*\*(.+?)\*\*/g, "$1");
  out = out.replace(/__(.+?)__/g, "$1");
  out = out.replace(/(?<!\*)\*(?!\s)([^*\n]+?)\*(?!\*)/g, "$1");
  out = out.replace(/(?<!_)_(?!\s)([^_\n]+?)_(?!_)/g, "$1");
  // inline code: `code`
  out = out.replace(/`([^`]+)`/g, "$1");
  // links [text](url) -> text (url)
  out = out.replace(/\[([^\]]+)\]\(([^)]+)\)/g, "$1 ($2)");
  return out;
}

/* Typography tuned to mirror the on-screen assistant prose styles
 * (prose-h1 xl, h2 lg, h3 base, h4 sm, body sm leading-relaxed). */
const TYPO = {
  h1: { size: 16, preGap: 10, postGap: 6 },
  h2: { size: 14, preGap: 9, postGap: 5 },
  h3: { size: 12, preGap: 7, postGap: 4 },
  h4: { size: 11, preGap: 6, postGap: 3 },
  body: { size: 10.5, postGap: 5 },
  list: { size: 10.5, itemGap: 2, baseIndent: 14, levelStep: 14, markerGap: 8 },
};

/** Draw a bullet/number marker at a column, then wrap the text body with a
 *  hanging indent so continuation lines align under the text, not the marker. */
function drawListItem(
  doc: ReturnType<typeof createPdf>,
  y: number,
  marker: string,
  body: string,
  depth: number,
): number {
  const markerX = MARGINS.left + TYPO.list.baseIndent + depth * TYPO.list.levelStep;
  const textIndent = markerX - MARGINS.left + TYPO.list.markerGap;
  doc.setFont(FONT.family, "normal");
  doc.setFontSize(TYPO.list.size);
  doc.setTextColor(...PALETTE.text);
  doc.text(marker, markerX, y);
  return writeWrapped(doc, body, y, {
    size: TYPO.list.size,
    indent: textIndent,
    maxWidth: CONTENT_WIDTH - textIndent,
    gap: TYPO.list.itemGap,
  });
}

/** Render a simple markdown-ish block of assistant text into the pdfKit doc.
 *  Supports: #/##/###/#### headings, -/* bullets (nested), 1. ordered items,
 *  pipe tables, --- horizontal rules, blank lines. Inline emphasis is stripped. */
function renderMarkdownToPdf(doc: ReturnType<typeof createPdf>, text: string, startY: number): number {
  let y = startY;
  const lines = text.replace(/\r\n/g, "\n").split("\n");
  let i = 0;
  while (i < lines.length) {
    const raw = lines[i];
    const line = raw.replace(/\s+$/, "");

    // Table block: header | --- | body
    if (/^\s*\|.+\|\s*$/.test(line) && i + 1 < lines.length && /^\s*\|?\s*:?-{3,}/.test(lines[i + 1])) {
      const parseRow = (s: string) =>
        s.trim().replace(/^\|/, "").replace(/\|$/, "").split("|").map((c) => stripInlineMd(c.trim()));
      const head = [parseRow(line)];
      i += 2;
      const body: string[][] = [];
      while (i < lines.length && /^\s*\|.+\|\s*$/.test(lines[i])) {
        body.push(parseRow(lines[i]));
        i++;
      }
      y = drawTable(doc, { head, body, startY: y });
      continue;
    }

    if (line.trim() === "") {
      y += 4;
      i++;
      continue;
    }

    // Horizontal rule
    if (/^\s*([-*_])\1{2,}\s*$/.test(line)) {
      y += 6;
      if (y > LETTER.height - MARGINS.bottom) {
        doc.addPage();
        y = MARGINS.top;
      }
      doc.setDrawColor(...PALETTE.rule);
      doc.setLineWidth(0.5);
      doc.line(MARGINS.left, y, MARGINS.left + CONTENT_WIDTH, y);
      y += 10;
      i++;
      continue;
    }

    // Headings
    const heading = /^(#{1,6})\s+(.*)$/.exec(line);
    if (heading) {
      const level = Math.min(4, heading[1].length);
      const content = stripInlineMd(heading[2]);
      const t = level === 1 ? TYPO.h1 : level === 2 ? TYPO.h2 : level === 3 ? TYPO.h3 : TYPO.h4;
      y = writeWrapped(doc, content, y + t.preGap, { size: t.size, bold: true, gap: t.postGap });
      i++;
      continue;
    }

    // Bullet (depth from leading-space count, 2 spaces per level)
    const bullet = /^(\s*)[-*]\s+(.*)$/.exec(line);
    if (bullet) {
      const depth = Math.min(3, Math.floor(bullet[1].length / 2));
      y = drawListItem(doc, y, "\u2022", stripInlineMd(bullet[2]), depth);
      i++;
      continue;
    }

    // Ordered list
    const ordered = /^(\s*)(\d+)\.\s+(.*)$/.exec(line);
    if (ordered) {
      const depth = Math.min(3, Math.floor(ordered[1].length / 2));
      y = drawListItem(doc, y, `${ordered[2]}.`, stripInlineMd(ordered[3]), depth);
      i++;
      continue;
    }

    // Paragraph
    y = writeWrapped(doc, stripInlineMd(line), y, { size: TYPO.body.size, gap: TYPO.body.postGap });
    i++;
  }
  return y;
}


/**
 * Per-message "Save as PDF" action — exports a single assistant message
 * as a plain .pdf using the shared pdfKit (skill-rule guardrails).
 */
export function MessageSaveAsPdfButton({ message, thread }: Props) {
  const [busy, setBusy] = useState(false);

  if (message.role !== "assistant") return null;
  const text = (message.parts ?? [])
    .map((p) => (p.type === "text" ? p.text ?? "" : ""))
    .join("\n")
    .trim();
  if (!text) return null;

  const onClick = async () => {
    setBusy(true);
    try {
      const shortId = message.id.slice(0, 8);
      const title = thread?.title?.trim() || "Assistant message";
      const created = message.created_at ? new Date(message.created_at) : new Date();
      const subtitle = `Saved ${created.toLocaleString()}`;

      const doc = createPdf({ title, subject: "Assistant message", keywords: "assistant,message" });
      let y = drawHeader(doc, { title, subtitle });
      // subtle rule under header
      doc.setDrawColor(...PALETTE.rule);
      doc.line(MARGINS.left, y - 2, 612 - MARGINS.right, y - 2);
      y += 6;
      renderMarkdownToPdf(doc, text, y);

      const base = thread?.title
        ? [thread.title, "message", shortId]
        : ["assistant-message", shortId];
      savePdf(doc, base, { left: title, showPageNumbers: true });
    } catch (e: any) {
      toast({
        title: "Export failed",
        description: e?.message ?? "Could not save this message as PDF",
        variant: "destructive",
      });
    } finally {
      setBusy(false);
    }
  };

  return (
    <Button
      type="button"
      variant="ghost"
      size="sm"
      className="h-7 px-2 text-[11px] gap-1.5 text-muted-foreground"
      onClick={onClick}
      disabled={busy}
      title="Save this message as PDF"
    >
      {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <FileDown className="h-3.5 w-3.5" />}
      Save as PDF
    </Button>
  );
}
