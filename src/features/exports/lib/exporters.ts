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
  PageBreak,
  Header,
  Footer,
  PageNumber,
  ImageRun,
  BorderStyle,
} from "docx";

export type ExportFormat = "pdf" | "docx";
export type ExportPageSize = "letter" | "a4";

/** Brand template applied at export time (resolved by the caller). */
export interface BrandOptions {
  primaryColor?: string;
  accentColor?: string;
  firmName?: string;
  headerText?: string;
  footerText?: string;
  showPageNumbers?: boolean;
  showLogoOnCover?: boolean;
  /** Pre-fetched logo (caller is responsible for downloading and converting). */
  logo?: {
    dataUrl: string;
    mime: string;
    /** Natural width/height in px — used to preserve aspect ratio. */
    widthPx: number;
    heightPx: number;
  };
}

export interface ExportOptions {
  pageSize?: ExportPageSize;
  /** Override the filename base (without extension) */
  filenameBase?: string;
  /** User-supplied version string (rendered on the cover page) */
  version?: string;
  /** Suppress the cover page (defaults to false). */
  noCover?: boolean;
  /** Resolved brand template — falls back to neutral defaults. */
  brand?: BrandOptions;
}

export interface ExportCover {
  clientName?: string;
  solicitationTitle?: string;
  phase?: string;
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
  /** Optional metadata used for the cover page */
  cover?: ExportCover;
}

const sanitize = (s: string) => s.replace(/[^a-z0-9-_]+/gi, "_").slice(0, 80);

function fmtDate() {
  return new Date().toISOString().slice(0, 10);
}

function fmtDateTime() {
  return new Date().toLocaleString(undefined, {
    year: "numeric",
    month: "long",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

const PHASE_LABELS: Record<string, string> = {
  phase_1_initial: "Phase 1 — Initial",
  phase_2_outline: "Phase 2 — Outline",
  phase_3_deep_dive: "Phase 3 — Deep Dive",
  phase_4_win_themes: "Phase 4 — Win Themes",
  phase_5_complete: "Phase 5 — Complete",
};

function phaseLabel(p?: string) {
  if (!p) return undefined;
  return PHASE_LABELS[p] ?? p.replace(/_/g, " ");
}

/* -------------------- Color & image helpers -------------------- */
function normalizeHex(hex?: string): string | null {
  if (!hex) return null;
  const m = hex.replace("#", "").trim();
  if (/^[0-9a-fA-F]{3}$/.test(m)) return m.split("").map((c) => c + c).join("").toUpperCase();
  if (/^[0-9a-fA-F]{6}$/.test(m)) return m.toUpperCase();
  return null;
}

function hexToRgb(hex: string | undefined, fallback: [number, number, number]): [number, number, number] {
  const n = normalizeHex(hex);
  if (!n) return fallback;
  return [parseInt(n.slice(0, 2), 16), parseInt(n.slice(2, 4), 16), parseInt(n.slice(4, 6), 16)];
}

function hexNoHash(hex: string | undefined, fallback = "283C5A"): string {
  return normalizeHex(hex) ?? fallback;
}

function pdfImageFormat(mime: string): "PNG" | "JPEG" | null {
  if (mime.includes("png")) return "PNG";
  if (mime.includes("jpeg") || mime.includes("jpg")) return "JPEG";
  return null;
}

/* -------------------- PDF -------------------- */
function renderPdf(doc: ExportDocument, opts: ExportOptions = {}): Blob {
  const brand = opts.brand ?? {};
  const primary = hexToRgb(brand.primaryColor, [40, 60, 90]);
  const onPrimary = hexToRgb(brand.accentColor, [255, 255, 255]);

  const pdf = new jsPDF({ unit: "pt", format: opts.pageSize ?? "letter" });
  const margin = 48;
  const pageW = pdf.internal.pageSize.getWidth();
  const pageH = pdf.internal.pageSize.getHeight();
  // Reserve a little extra space at top/bottom of body pages for header/footer
  const bodyTop = margin + (brand.headerText ? 18 : 0);
  const bodyBottom = pageH - margin - (brand.footerText || brand.showPageNumbers ? 18 : 0);
  let y = bodyTop;
  // Track which page index is the cover (so we can skip header/footer on it)
  let coverPageIndex: number | null = null;

  const ensureSpace = (h: number) => {
    if (y + h > bodyBottom) {
      pdf.addPage();
      y = bodyTop;
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

  // ---- Cover page ----
  if (!opts.noCover) {
    coverPageIndex = pdf.getCurrentPageInfo().pageNumber;
    const cover = doc.cover ?? {};

    // Top + bottom accent bars in primary color
    pdf.setFillColor(...primary);
    pdf.rect(0, 0, pageW, 14, "F");
    pdf.rect(0, pageH - 14, pageW, 14, "F");

    let coverY = margin + 30;

    // Optional logo
    const logo = brand.logo;
    const logoFmt = logo ? pdfImageFormat(logo.mime) : null;
    if (brand.showLogoOnCover !== false && logo && logoFmt) {
      const maxW = 220;
      const maxH = 90;
      const ratio = logo.widthPx && logo.heightPx ? logo.widthPx / logo.heightPx : 1;
      let lw = maxW;
      let lh = lw / ratio;
      if (lh > maxH) {
        lh = maxH;
        lw = lh * ratio;
      }
      try {
        pdf.addImage(logo.dataUrl, logoFmt, (pageW - lw) / 2, coverY, lw, lh);
        coverY += lh + 28;
      } catch {
        // ignore unsupported image
      }
    }

    // Firm name (small caps above title)
    if (brand.firmName) {
      pdf.setFont("helvetica", "bold");
      pdf.setFontSize(11);
      pdf.setTextColor(...primary);
      pdf.text(brand.firmName.toUpperCase(), pageW / 2, coverY, { align: "center" });
      coverY += 18;
    } else if (cover.clientName) {
      pdf.setFont("helvetica", "bold");
      pdf.setFontSize(11);
      pdf.setTextColor(...primary);
      pdf.text(cover.clientName.toUpperCase(), pageW / 2, coverY, { align: "center" });
      coverY += 18;
    }

    // Title (centered, large)
    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(28);
    pdf.setTextColor(25, 25, 25);
    const titleLines = pdf.splitTextToSize(doc.title, pageW - margin * 2);
    titleLines.forEach((line: string, idx: number) => {
      pdf.text(line, pageW / 2, coverY + idx * 32, { align: "center" });
    });
    coverY += titleLines.length * 32 + 12;

    // Solicitation title
    if (cover.solicitationTitle) {
      pdf.setFont("helvetica", "normal");
      pdf.setFontSize(14);
      pdf.setTextColor(80, 80, 80);
      const subLines = pdf.splitTextToSize(cover.solicitationTitle, pageW - margin * 2);
      subLines.forEach((line: string, idx: number) => {
        pdf.text(line, pageW / 2, coverY + idx * 18, { align: "center" });
      });
      coverY += subLines.length * 18 + 24;
    }

    // Client name (only if not already shown via firmName branch)
    if (brand.firmName && cover.clientName) {
      pdf.setFont("helvetica", "normal");
      pdf.setFontSize(11);
      pdf.setTextColor(120, 120, 120);
      pdf.text(`Prepared for ${cover.clientName}`, pageW / 2, coverY, { align: "center" });
      coverY += 24;
    }

    // Meta block (anchored toward lower-third)
    const meta: [string, string][] = [];
    const phase = phaseLabel(cover.phase);
    if (phase) meta.push(["Phase", phase]);
    if (opts.version?.trim()) meta.push(["Version", opts.version.trim()]);
    meta.push(["Generated", fmtDateTime()]);

    const metaTop = Math.max(coverY + 40, pageH * 0.7);
    pdf.setDrawColor(220, 220, 220);
    pdf.line(pageW / 2 - 110, metaTop - 16, pageW / 2 + 110, metaTop - 16);
    meta.forEach((row, i) => {
      const ry = metaTop + i * 18;
      pdf.setFont("helvetica", "bold");
      pdf.setFontSize(9);
      pdf.setTextColor(120, 120, 120);
      pdf.text(row[0].toUpperCase(), pageW / 2 - 12, ry, { align: "right" });
      pdf.setFont("helvetica", "normal");
      pdf.setTextColor(40, 40, 40);
      pdf.text(row[1], pageW / 2 + 12, ry, { align: "left" });
    });

    pdf.addPage();
    y = bodyTop;
  }

  // Title (body intro)
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
        margin: { left: margin + depth * 12, right: margin, top: bodyTop, bottom: pageH - bodyBottom },
        styles: { fontSize: 9, cellPadding: 4, overflow: "linebreak" },
        headStyles: { fillColor: primary, textColor: onPrimary },
        theme: "striped",
      });
      // @ts-expect-error lastAutoTable populated by plugin
      y = pdf.lastAutoTable.finalY + 10;
    }

    s.children?.forEach((c) => renderSection(c, depth + 1));
  };

  doc.sections.forEach((s) => renderSection(s, 0));

  // ---- Stamp header/footer on every body page ----
  const totalPages = pdf.getNumberOfPages();
  const showHeader = !!brand.headerText;
  const showFooterText = !!brand.footerText;
  const showFooterPageNo = brand.showPageNumbers !== false;
  if (showHeader || showFooterText || showFooterPageNo) {
    for (let p = 1; p <= totalPages; p++) {
      if (coverPageIndex !== null && p === coverPageIndex) continue; // skip cover
      pdf.setPage(p);

      if (showHeader && brand.headerText) {
        pdf.setFont("helvetica", "normal");
        pdf.setFontSize(8);
        pdf.setTextColor(110, 110, 110);
        pdf.text(brand.headerText, margin, margin / 2 + 4);
        pdf.setDrawColor(...primary);
        pdf.setLineWidth(0.5);
        pdf.line(margin, margin / 2 + 8, pageW - margin, margin / 2 + 8);
      }

      const footerY = pageH - margin / 2 - 4;
      if (showFooterText || showFooterPageNo) {
        pdf.setDrawColor(...primary);
        pdf.setLineWidth(0.5);
        pdf.line(margin, footerY - 10, pageW - margin, footerY - 10);
        pdf.setFont("helvetica", "normal");
        pdf.setFontSize(8);
        pdf.setTextColor(110, 110, 110);
        if (showFooterText && brand.footerText) {
          pdf.text(brand.footerText, margin, footerY);
        }
        if (showFooterPageNo) {
          const bodyPages = coverPageIndex !== null ? totalPages - 1 : totalPages;
          const bodyIndex = coverPageIndex !== null && p > coverPageIndex ? p - 1 : p;
          pdf.text(`Page ${bodyIndex} of ${bodyPages}`, pageW - margin, footerY, { align: "right" });
        }
      }
    }
  }

  return pdf.output("blob");
}

/* -------------------- DOCX -------------------- */
function dataUrlToBytes(dataUrl: string): Uint8Array {
  const b64 = dataUrl.split(",")[1] ?? "";
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

function renderDocxSection(s: ExportSection, depth = 0, primaryHex = "283C5A", onPrimaryHex = "FFFFFF"): (Paragraph | Table)[] {
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
          shading: { fill: primaryHex },
          children: [new Paragraph({ children: [new TextRun({ text: h, bold: true, color: onPrimaryHex })] })],
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

async function renderDocx(doc: ExportDocument, opts: ExportOptions = {}): Promise<Blob> {
  const children: (Paragraph | Table)[] = [];

  // ---- Cover page ----
  if (!opts.noCover) {
    const cover = doc.cover ?? {};
    // Spacer to push content down
    for (let i = 0; i < 6; i++) {
      children.push(new Paragraph({ children: [new TextRun("")] }));
    }
    if (cover.clientName) {
      children.push(new Paragraph({
        alignment: AlignmentType.CENTER,
        children: [new TextRun({ text: cover.clientName.toUpperCase(), bold: true, color: "283C5A", size: 22 })],
      }));
    }
    children.push(new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { before: 240, after: 240 },
      children: [new TextRun({ text: doc.title, bold: true, size: 56 })],
    }));
    if (cover.solicitationTitle) {
      children.push(new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { after: 480 },
        children: [new TextRun({ text: cover.solicitationTitle, color: "555555", size: 28 })],
      }));
    }

    const meta: [string, string][] = [];
    const phase = phaseLabel(cover.phase);
    if (phase) meta.push(["Phase", phase]);
    if (opts.version?.trim()) meta.push(["Version", opts.version.trim()]);
    meta.push(["Generated", fmtDateTime()]);

    meta.forEach(([k, v]) => {
      children.push(new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { before: 60, after: 60 },
        children: [
          new TextRun({ text: `${k.toUpperCase()}  `, bold: true, color: "888888", size: 18 }),
          new TextRun({ text: v, size: 20 }),
        ],
      }));
    });

    // Page break to start content on a new page
    children.push(new Paragraph({ children: [new PageBreak()] }));
  }

  // ---- Body ----
  children.push(new Paragraph({
    heading: HeadingLevel.TITLE,
    alignment: AlignmentType.LEFT,
    children: [new TextRun({ text: doc.title, bold: true })],
  }));
  if (doc.subtitle) children.push(new Paragraph({ children: [new TextRun({ text: doc.subtitle, italics: true })] }));
  children.push(new Paragraph({ children: [new TextRun({ text: `Generated ${fmtDate()}`, color: "888888", size: 18 })] }));

  doc.sections.forEach((s) => children.push(...renderDocxSection(s, 0)));

  // US Letter: 12240 x 15840 DXA. A4: 11906 x 16838 DXA.
  const size = opts.pageSize === "a4"
    ? { width: 11906, height: 16838 }
    : { width: 12240, height: 15840 };

  const docx = new Document({
    sections: [{
      properties: {
        page: {
          size,
          margin: { top: 1440, right: 1440, bottom: 1440, left: 1440 },
        },
      },
      children,
    }],
  });
  const blob = await Packer.toBlob(docx);
  return blob;
}

/* -------------------- Public API -------------------- */
export async function exportDocument(doc: ExportDocument, format: ExportFormat, opts: ExportOptions = {}) {
  const base = opts.filenameBase?.trim() || doc.filenameBase;
  const filename = `${sanitize(base)}_${fmtDate()}.${format}`;
  if (format === "pdf") {
    const blob = renderPdf(doc, opts);
    saveAs(blob, filename);
  } else {
    const blob = await renderDocx(doc, opts);
    saveAs(blob, filename);
  }
}
