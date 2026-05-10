import jsPDF from "jspdf";
import type { ReportContent } from "../templates/types";

function stripMd(line: string): string {
  return line
    .replace(/\*\*(.+?)\*\*/g, "$1")
    .replace(/\*(.+?)\*/g, "$1")
    .replace(/`(.+?)`/g, "$1")
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1");
}

export function generatePdf(report: ReportContent): Blob {
  const doc = new jsPDF({ unit: "pt", format: "letter" });
  const margin = 56;
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const contentW = pageW - margin * 2;
  let y = margin;

  const ensureSpace = (h: number) => {
    if (y + h > pageH - margin) {
      doc.addPage();
      y = margin;
    }
  };

  const writeText = (text: string, opts: { size?: number; bold?: boolean; color?: [number, number, number]; gap?: number } = {}) => {
    const { size = 11, bold = false, color = [30, 30, 30], gap = 4 } = opts;
    doc.setFont("helvetica", bold ? "bold" : "normal");
    doc.setFontSize(size);
    doc.setTextColor(color[0], color[1], color[2]);
    const lines = doc.splitTextToSize(text, contentW);
    for (const line of lines) {
      ensureSpace(size + gap);
      doc.text(line, margin, y);
      y += size + gap;
    }
  };

  // Cover
  doc.setFillColor(30, 64, 175);
  doc.rect(0, 0, pageW, 80, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.text("EXECUTIVE REPORT", margin, 50);
  y = 130;
  writeText(report.title, { size: 22, bold: true, gap: 8 });
  if (report.subtitle) writeText(report.subtitle, { size: 13, color: [100, 100, 100], gap: 6 });
  y += 8;
  if (report.meta) {
    Object.entries(report.meta)
      .filter(([, v]) => v != null && v !== "")
      .forEach(([k, v]) => writeText(`${k.replace(/_/g, " ")}: ${v}`, { size: 10, color: [80, 80, 80], gap: 2 }));
  }
  y += 6;
  writeText(`Generated ${new Date(report.generatedAt).toLocaleString()}`, { size: 9, color: [120, 120, 120] });

  doc.addPage();
  y = margin;

  for (const section of report.sections ?? []) {
    ensureSpace(40);
    writeText(section.heading, { size: section.level === 3 ? 13 : section.level === 2 ? 15 : 17, bold: true, color: [30, 64, 175], gap: 8 });
    const lines = (section.body ?? "").split(/\r?\n/);
    for (const raw of lines) {
      const line = raw.trim();
      if (!line) { y += 4; continue; }
      const clean = stripMd(line);
      if (/^[-*]\s+/.test(line)) {
        writeText(`• ${stripMd(line.replace(/^[-*]\s+/, ""))}`, { size: 11, gap: 3 });
      } else if (/^#{1,3}\s+/.test(line)) {
        writeText(stripMd(line.replace(/^#+\s+/, "")), { size: 13, bold: true, gap: 6 });
      } else {
        writeText(clean, { size: 11, gap: 3 });
      }
    }
    y += 8;
  }

  if (report.citations?.length) {
    doc.addPage();
    y = margin;
    writeText("Citations", { size: 17, bold: true, color: [30, 64, 175], gap: 10 });
    report.citations.forEach((c, i) => {
      writeText(
        `[${c.id || i + 1}] ${c.document}${c.section ? ` §${c.section}` : ""}${c.page ? ` p.${c.page}` : ""}${c.quote ? ` — "${c.quote}"` : ""}`,
        { size: 9, color: [60, 60, 60], gap: 2 }
      );
    });
  }

  return doc.output("blob");
}
