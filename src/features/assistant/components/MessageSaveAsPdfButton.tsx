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

/** Render a simple markdown-ish block of assistant text into the pdfKit doc.
 *  Supports: # / ## / ### headings, - / * bullets, 1. ordered items, pipe tables, blank lines. */
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
        s.trim().replace(/^\|/, "").replace(/\|$/, "").split("|").map((c) => c.trim());
      const head = [parseRow(line)];
      i += 2; // skip header + separator
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

    const h1 = /^#\s+(.*)$/.exec(line);
    const h2 = /^##\s+(.*)$/.exec(line);
    const h3 = /^###\s+(.*)$/.exec(line);
    const bullet = /^\s*[-*]\s+(.*)$/.exec(line);
    const ordered = /^\s*(\d+)\.\s+(.*)$/.exec(line);

    if (h1) {
      y = writeWrapped(doc, h1[1], y + 4, { size: FONT.h2, bold: true, gap: 4 });
    } else if (h2) {
      y = writeWrapped(doc, h2[1], y + 2, { size: FONT.h3, bold: true, gap: 3 });
    } else if (h3) {
      y = writeWrapped(doc, h3[1], y + 2, { size: FONT.body, bold: true, gap: 2 });
    } else if (bullet) {
      y = writeWrapped(doc, `\u2022 ${bullet[1]}`, y, { indent: 12, gap: 1 });
    } else if (ordered) {
      y = writeWrapped(doc, `${ordered[1]}. ${ordered[2]}`, y, { indent: 12, gap: 1 });
    } else {
      y = writeWrapped(doc, line, y, { gap: 3 });
    }
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
