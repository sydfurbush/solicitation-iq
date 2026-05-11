import { saveAs } from "file-saver";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import {
  Document,
  Packer,
  Paragraph,
  HeadingLevel,
  TextRun,
  Table,
  TableRow,
  TableCell,
  WidthType,
  AlignmentType,
} from "docx";

export type ExportFormat = "pdf" | "docx";
export type ExportPageSize = "letter" | "a4";

export interface ExportOptions {
  pageSize?: ExportPageSize;
  /** Override the filename base (without extension) */
  filenameBase?: string;
}

export interface ExportSection {
  heading: string;
  /** Plain paragraphs of text */
  paragraphs?: string[];
  /** Bulleted list items */
  bullets?: string[];
  /** Tabular block: first row is the header */
  table?: { head: string[]; rows: string[][] };
  /** Nested sub-sections */
  children?: ExportSection[];
}

export interface ExportDocument {
  title: string;
  subtitle?: string;
  sections: ExportSection[];
  filenameBase: string;
}

const sanitize = (s: string) => s.replace(/[^a-z0-9-_]+/gi, "_").slice(0, 80);

function fmtDate() {
  return new Date().toISOString().slice(0, 10);
}

/* -------------------- PDF -------------------- */
function renderPdf(doc: ExportDocument): Blob {
  const pdf = new jsPDF({ unit: "pt", format: "letter" });
  const margin = 48;
  const pageW = pdf.internal.pageSize.getWidth();
  const pageH = pdf.internal.pageSize.getHeight();
  let y = margin;

  const ensureSpace = (h: number) => {
    if (y + h > pageH - margin) {
      pdf.addPage();
      y = margin;
    }
  };

  const writeWrapped = (text: string, opts: { size: number; bold?: boolean; indent?: number; color?: [number, number, number] }) => {
    pdf.setFont("helvetica", opts.bold ? "bold" : "normal");
    pdf.setFontSize(opts.size);
    if (opts.color) pdf.setTextColor(...opts.color); else pdf.setTextColor(20, 20, 20);
    const indent = opts.indent ?? 0;
    const lines = pdf.splitTextToSize(text, pageW - margin * 2 - indent);
    for (const line of lines) {
      ensureSpace(opts.size + 4);
      pdf.text(line, margin + indent, y);
      y += opts.size + 4;
    }
  };

  // Title
  writeWrapped(doc.title, { size: 20, bold: true });
  if (doc.subtitle) writeWrapped(doc.subtitle, { size: 11, color: [110, 110, 110] });
  writeWrapped(`Generated ${fmtDate()}`, { size: 9, color: [140, 140, 140] });
  y += 8;

  const renderSection = (s: ExportSection, depth = 0) => {
    const headingSize = depth === 0 ? 14 : depth === 1 ? 12 : 11;
    y += depth === 0 ? 10 : 6;
    writeWrapped(s.heading, { size: headingSize, bold: true, indent: depth * 12 });
    y += 2;

    s.paragraphs?.forEach((p) => writeWrapped(p, { size: 10, indent: depth * 12 }));

    s.bullets?.forEach((b) => writeWrapped(`•  ${b}`, { size: 10, indent: depth * 12 + 8 }));

    if (s.table) {
      ensureSpace(40);
      autoTable(pdf, {
        startY: y,
        head: [s.table.head],
        body: s.table.rows,
        margin: { left: margin + depth * 12, right: margin },
        styles: { fontSize: 9, cellPadding: 4, overflow: "linebreak" },
        headStyles: { fillColor: [40, 60, 90], textColor: 255 },
        theme: "striped",
      });
      // @ts-expect-error lastAutoTable populated by plugin
      y = pdf.lastAutoTable.finalY + 10;
    }

    s.children?.forEach((c) => renderSection(c, depth + 1));
  };

  doc.sections.forEach((s) => renderSection(s, 0));

  return pdf.output("blob");
}

/* -------------------- DOCX -------------------- */
function renderDocxSection(s: ExportSection, depth = 0): (Paragraph | Table)[] {
  const out: (Paragraph | Table)[] = [];
  const headingLevel =
    depth === 0 ? HeadingLevel.HEADING_1 :
    depth === 1 ? HeadingLevel.HEADING_2 :
    HeadingLevel.HEADING_3;

  out.push(new Paragraph({ heading: headingLevel, children: [new TextRun({ text: s.heading, bold: true })] }));

  s.paragraphs?.forEach((p) => out.push(new Paragraph({ children: [new TextRun(p)] })));

  s.bullets?.forEach((b) =>
    out.push(new Paragraph({ bullet: { level: 0 }, children: [new TextRun(b)] })),
  );

  if (s.table) {
    const headRow = new TableRow({
      tableHeader: true,
      children: s.table.head.map((h) =>
        new TableCell({
          shading: { fill: "E5E7EB" },
          children: [new Paragraph({ children: [new TextRun({ text: h, bold: true })] })],
        }),
      ),
    });
    const bodyRows = s.table.rows.map((row) =>
      new TableRow({
        children: row.map((cell) =>
          new TableCell({
            children: [new Paragraph({ children: [new TextRun(cell ?? "")] })],
          }),
        ),
      }),
    );
    out.push(
      new Table({
        width: { size: 100, type: WidthType.PERCENTAGE },
        rows: [headRow, ...bodyRows],
      }),
    );
    out.push(new Paragraph({ children: [new TextRun("")] }));
  }

  s.children?.forEach((c) => out.push(...renderDocxSection(c, depth + 1)));
  return out;
}

async function renderDocx(doc: ExportDocument): Promise<Blob> {
  const children: (Paragraph | Table)[] = [
    new Paragraph({
      heading: HeadingLevel.TITLE,
      alignment: AlignmentType.LEFT,
      children: [new TextRun({ text: doc.title, bold: true })],
    }),
  ];
  if (doc.subtitle) children.push(new Paragraph({ children: [new TextRun({ text: doc.subtitle, italics: true })] }));
  children.push(new Paragraph({ children: [new TextRun({ text: `Generated ${fmtDate()}`, color: "888888", size: 18 })] }));

  doc.sections.forEach((s) => children.push(...renderDocxSection(s, 0)));

  const docx = new Document({ sections: [{ children }] });
  const blob = await Packer.toBlob(docx);
  return blob;
}

/* -------------------- Public API -------------------- */
export async function exportDocument(doc: ExportDocument, format: ExportFormat) {
  const filename = `${sanitize(doc.filenameBase)}_${fmtDate()}.${format}`;
  if (format === "pdf") {
    const blob = renderPdf(doc);
    saveAs(blob, filename);
  } else {
    const blob = await renderDocx(doc);
    saveAs(blob, filename);
  }
}
