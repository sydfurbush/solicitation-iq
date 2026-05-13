import { saveAs } from "file-saver";
import { Document, Packer, Paragraph, TextRun, HeadingLevel, Table, TableRow, TableCell, WidthType } from "docx";
import jsPDF from "jspdf";
import type { DocMatch } from "./documentMatcher";
import type { SectionPair } from "./sectionMatcher";
import type { Revision } from "../hooks/useRevisions";

export type ChangeReportInput = {
  solicitationTitle: string;
  revisionA: Revision;
  revisionB: Revision;
  mode: "incremental" | "cumulative";
  matches: DocMatch[];
  // Optional per-document section diffs (only for "modified" docs the user wants in the report)
  documentDiffs?: Array<{ docName: string; pairs: SectionPair[] }>;
  aiSummary?: string | null;
  recommendations?: string[];
};

function fmtDate(d: string) {
  try { return new Date(d).toLocaleDateString(); } catch { return d; }
}

export async function exportChangeReportWord(input: ChangeReportInput) {
  const { solicitationTitle, revisionA, revisionB, mode, matches, documentDiffs, aiSummary, recommendations } = input;
  const docChildren: Array<Paragraph | Table> = [
    new Paragraph({ text: "Change Report", heading: HeadingLevel.TITLE }),
    new Paragraph({ text: solicitationTitle, heading: HeadingLevel.HEADING_2 }),
    new Paragraph({
      children: [new TextRun({ text: `${revisionA.label} → ${revisionB.label}`, bold: true })],
    }),
    new Paragraph({
      children: [new TextRun({ text: `Mode: ${mode} • Generated ${new Date().toLocaleString()}`, italics: true })],
    }),
    new Paragraph({ text: "" }),
  ];

  if (aiSummary) {
    docChildren.push(new Paragraph({ text: "Executive summary", heading: HeadingLevel.HEADING_2 }));
    docChildren.push(new Paragraph({ text: aiSummary }));
    docChildren.push(new Paragraph({ text: "" }));
  }

  // Document match table
  docChildren.push(new Paragraph({ text: "Documents", heading: HeadingLevel.HEADING_2 }));
  docChildren.push(
    new Table({
      width: { size: 100, type: WidthType.PERCENTAGE },
      rows: [
        new TableRow({
          children: ["Document", "Status", "Page Δ", "Match"].map((t) =>
            new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: t, bold: true })] })] })
          ),
        }),
        ...matches.map((m) =>
          new TableRow({
            children: [
              new TableCell({ children: [new Paragraph(m.b?.file_name ?? m.a?.file_name ?? "—")] }),
              new TableCell({ children: [new Paragraph(m.status)] }),
              new TableCell({ children: [new Paragraph(m.pageDelta == null ? "—" : (m.pageDelta > 0 ? `+${m.pageDelta}` : `${m.pageDelta}`))] }),
              new TableCell({ children: [new Paragraph(m.similarity == null ? "—" : `${Math.round(m.similarity * 100)}%`)] }),
            ],
          })
        ),
      ],
    }),
  );
  docChildren.push(new Paragraph({ text: "" }));

  // Section-by-section
  if (documentDiffs && documentDiffs.length) {
    docChildren.push(new Paragraph({ text: "Section-by-section changes", heading: HeadingLevel.HEADING_2 }));
    documentDiffs.forEach((dd) => {
      docChildren.push(new Paragraph({ text: dd.docName, heading: HeadingLevel.HEADING_3 }));
      dd.pairs.filter((p) => p.status !== "unchanged").forEach((p) => {
        const title = `${p.b?.section_number ?? p.a?.section_number ?? ""} ${p.b?.section_title ?? p.a?.section_title ?? "(untitled)"}`.trim();
        docChildren.push(new Paragraph({
          children: [new TextRun({ text: `[${p.status}${p.status === "modified" ? ` ${Math.round(p.density * 100)}%` : ""}] `, bold: true }), new TextRun({ text: title })],
        }));
        if (p.status === "modified" && p.diff) {
          // Inline annotated text
          const runs = p.diff.flatMap((part) => {
            if (part.added) return [new TextRun({ text: part.value, color: "0a7c2f" })];
            if (part.removed) return [new TextRun({ text: part.value, color: "b91c1c", strike: true })];
            return [new TextRun({ text: part.value })];
          });
          docChildren.push(new Paragraph({ children: runs }));
        } else if (p.status === "added" && p.b?.content) {
          docChildren.push(new Paragraph({ children: [new TextRun({ text: p.b.content, color: "0a7c2f" })] }));
        } else if (p.status === "removed" && p.a?.content) {
          docChildren.push(new Paragraph({ children: [new TextRun({ text: p.a.content, color: "b91c1c", strike: true })] }));
        }
        docChildren.push(new Paragraph({ text: "" }));
      });
    });
  }

  if (recommendations && recommendations.length) {
    docChildren.push(new Paragraph({ text: "Strategic recommendations", heading: HeadingLevel.HEADING_2 }));
    recommendations.forEach((r) => {
      docChildren.push(new Paragraph({ text: r, bullet: { level: 0 } }));
    });
  }

  const doc = new Document({ sections: [{ children: docChildren }] });
  const blob = await Packer.toBlob(doc);
  saveAs(blob, `change-report-${slug(revisionA.label)}-to-${slug(revisionB.label)}.docx`);
}

export function exportChangeReportPdf(input: ChangeReportInput) {
  const { solicitationTitle, revisionA, revisionB, mode, matches, documentDiffs, aiSummary, recommendations } = input;
  const pdf = new jsPDF({ unit: "pt", format: "letter" });
  const margin = 48;
  const pageW = pdf.internal.pageSize.getWidth();
  const pageH = pdf.internal.pageSize.getHeight();
  let y = margin;

  const writeLine = (text: string, opts: { size?: number; bold?: boolean; color?: [number, number, number]; indent?: number } = {}) => {
    const size = opts.size ?? 11;
    pdf.setFont("helvetica", opts.bold ? "bold" : "normal");
    pdf.setFontSize(size);
    if (opts.color) pdf.setTextColor(...opts.color); else pdf.setTextColor(20, 20, 20);
    const wrapped = pdf.splitTextToSize(text, pageW - margin * 2 - (opts.indent ?? 0));
    wrapped.forEach((ln: string) => {
      if (y > pageH - margin) { pdf.addPage(); y = margin; }
      pdf.text(ln, margin + (opts.indent ?? 0), y);
      y += size * 1.3;
    });
  };

  writeLine("Change Report", { size: 22, bold: true });
  writeLine(solicitationTitle, { size: 14, bold: true });
  writeLine(`${revisionA.label} (${fmtDate(revisionA.received_at)}) → ${revisionB.label} (${fmtDate(revisionB.received_at)})`, { size: 11 });
  writeLine(`Mode: ${mode} • Generated ${new Date().toLocaleString()}`, { size: 9, color: [110, 110, 110] });
  y += 8;

  if (aiSummary) {
    writeLine("Executive summary", { size: 14, bold: true });
    writeLine(aiSummary);
    y += 8;
  }

  writeLine("Documents", { size: 14, bold: true });
  matches.forEach((m) => {
    const name = m.b?.file_name ?? m.a?.file_name ?? "—";
    const meta = `[${m.status}]${m.pageDelta != null && m.pageDelta !== 0 ? ` ${m.pageDelta > 0 ? "+" : ""}${m.pageDelta}p` : ""}`;
    writeLine(`• ${meta} ${name}`);
  });
  y += 8;

  if (documentDiffs && documentDiffs.length) {
    writeLine("Section-by-section changes", { size: 14, bold: true });
    documentDiffs.forEach((dd) => {
      writeLine(dd.docName, { size: 12, bold: true });
      dd.pairs.filter((p) => p.status !== "unchanged").forEach((p) => {
        const title = `${p.b?.section_number ?? p.a?.section_number ?? ""} ${p.b?.section_title ?? p.a?.section_title ?? "(untitled)"}`.trim();
        writeLine(`[${p.status}${p.status === "modified" ? ` ${Math.round(p.density * 100)}%` : ""}] ${title}`, { bold: true, indent: 12 });
        const txt = p.b?.content ?? p.a?.content ?? "";
        if (txt) writeLine(txt.slice(0, 800), { indent: 12, color: p.status === "removed" ? [185, 28, 28] : p.status === "added" ? [10, 124, 47] : [40, 40, 40] });
      });
      y += 6;
    });
  }

  if (recommendations && recommendations.length) {
    writeLine("Strategic recommendations", { size: 14, bold: true });
    recommendations.forEach((r) => writeLine(`• ${r}`));
  }

  pdf.save(`change-report-${slug(revisionA.label)}-to-${slug(revisionB.label)}.pdf`);
}

function slug(s: string) {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}
