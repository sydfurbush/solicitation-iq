import { Document, Packer, Paragraph, TextRun, HeadingLevel, AlignmentType } from "docx";
import type { ReportContent } from "../templates/types";

function stripMd(s: string) {
  return s.replace(/\*\*(.+?)\*\*/g, "$1").replace(/\*(.+?)\*/g, "$1").replace(/`(.+?)`/g, "$1");
}

export async function generateDocx(report: ReportContent): Promise<Blob> {
  const children: Paragraph[] = [];
  children.push(new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: report.title, bold: true, size: 40 })] }));
  if (report.subtitle) children.push(new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: report.subtitle, italics: true, size: 24 })] }));
  children.push(new Paragraph({ children: [new TextRun({ text: `Generated ${new Date(report.generatedAt).toLocaleString()}`, size: 18, color: "888888" })] }));
  children.push(new Paragraph({ children: [new TextRun("")] }));

  for (const s of report.sections ?? []) {
    children.push(new Paragraph({ heading: s.level === 3 ? HeadingLevel.HEADING_3 : s.level === 2 ? HeadingLevel.HEADING_2 : HeadingLevel.HEADING_1, children: [new TextRun({ text: s.heading, bold: true })] }));
    for (const raw of (s.body ?? "").split(/\r?\n/)) {
      const line = raw.trim();
      if (!line) { children.push(new Paragraph({ children: [new TextRun("")] })); continue; }
      if (/^[-*]\s+/.test(line)) {
        children.push(new Paragraph({ bullet: { level: 0 }, children: [new TextRun(stripMd(line.replace(/^[-*]\s+/, "")))] }));
      } else if (/^#{1,3}\s+/.test(line)) {
        children.push(new Paragraph({ children: [new TextRun({ text: stripMd(line.replace(/^#+\s+/, "")), bold: true })] }));
      } else {
        children.push(new Paragraph({ children: [new TextRun(stripMd(line))] }));
      }
    }
  }

  if (report.citations?.length) {
    children.push(new Paragraph({ heading: HeadingLevel.HEADING_1, children: [new TextRun({ text: "Citations", bold: true })] }));
    report.citations.forEach((c, i) => {
      children.push(new Paragraph({ children: [new TextRun(`[${c.id || i + 1}] ${c.document}${c.section ? ` §${c.section}` : ""}${c.page ? ` p.${c.page}` : ""}${c.quote ? ` — "${c.quote}"` : ""}`)] }));
    });
  }

  const doc = new Document({ sections: [{ children }] });
  const buffer = await Packer.toBlob(doc);
  return buffer;
}
