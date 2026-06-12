import { format } from "date-fns";
import {
  createPdf,
  drawHeader,
  drawTable,
  writeWrapped,
  savePdf,
  FONT,
  PALETTE,
} from "@/lib/pdf/pdfKit";

export type WinLossPayload = {
  summary: string;
  win_patterns: Array<{ theme: string; detail: string }>;
  loss_patterns: Array<{ theme: string; detail: string }>;
  no_bid_rationale: Array<{ theme: string; detail: string }>;
  recommendations: string[];
  counts: Record<string, number>;
};

export function downloadWinLossPdf(payload: WinLossPayload, opts?: { from?: string; to?: string; clientName?: string }) {
  const doc = createPdf({ title: "Win / Loss Analysis", subject: "Win/loss analysis" });
  const periodLine = `${opts?.from ?? "All-time"} to ${opts?.to ?? "today"}`;
  let y = drawHeader(doc, {
    title: "Win / Loss Analysis",
    subtitle: opts?.clientName ? `Client: ${opts.clientName}` : "Organization-wide",
    meta: [`Period: ${periodLine}`, `Generated ${format(new Date(), "MMM d, yyyy")}`],
  });

  const c = payload.counts ?? {};
  y = drawTable(doc, {
    head: [["Outcome", "Count"]],
    body: [
      ["Won", String(c.won ?? 0)],
      ["Lost", String(c.lost ?? 0)],
      ["No-bid", String(c.no_bid ?? 0)],
      ["Withdrawn", String(c.withdrawn ?? 0)],
    ],
    startY: y + 4,
    columnStyles: { 0: { cellWidth: 200 }, 1: { cellWidth: "auto", halign: "right" } },
  });

  if (payload.summary) {
    y = writeWrapped(doc, "Summary", y + 8, { bold: true, size: FONT.h2, gap: 4 });
    y = writeWrapped(doc, payload.summary, y, { gap: 8 });
  }

  const renderGroup = (label: string, items: Array<{ theme: string; detail: string }>) => {
    if (!items.length) return;
    y = writeWrapped(doc, label, y + 4, { bold: true, size: FONT.h2, gap: 4 });
    for (const it of items) {
      y = writeWrapped(doc, it.theme, y, { bold: true, gap: 2 });
      y = writeWrapped(doc, it.detail, y, { color: PALETTE.muted, gap: 6 });
    }
  };

  renderGroup("Win patterns", payload.win_patterns);
  renderGroup("Loss patterns", payload.loss_patterns);
  renderGroup("No-bid rationale", payload.no_bid_rationale);

  if (payload.recommendations?.length) {
    y = writeWrapped(doc, "Recommendations", y + 4, { bold: true, size: FONT.h2, gap: 4 });
    for (const r of payload.recommendations) y = writeWrapped(doc, `• ${r}`, y, { indent: 12, gap: 4 });
  }

  savePdf(doc, ["win-loss-analysis", format(new Date(), "yyyy-MM-dd")], {
    left: "Win / Loss Analysis",
    center: periodLine,
    showPageNumbers: true,
  });
}
