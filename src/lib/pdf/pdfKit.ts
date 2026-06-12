/**
 * pdfKit — single chokepoint for app-wide PDF generation rules.
 *
 * Derived from the `pdf` agent skill. Every "Download PDF" path in the app
 * should reuse these primitives so page size, margins, header/footer, page
 * numbers, text sanitization, and filename slugging stay consistent.
 *
 * Skill guardrails enforced here:
 *  - US Letter (612 × 792 pt) is the default; never rely on jsPDF's A4 default.
 *  - Never insert Unicode subscript/superscript glyphs (\u2080–\u209F). jsPDF's
 *    built-in fonts do not ship those glyphs, just like ReportLab. Use plain
 *    text or `^`/`_` notation. `sanitizeForPdf` strips/replaces unsafe chars.
 *  - Page numbers are stamped at SAVE time over every page via `stampPageNumbers`.
 *  - Filenames are slug-safe and timestamped via `slugifyFilename`.
 *
 * Engine: jsPDF + jspdf-autotable. PDF post-processing (merge/watermark/
 * encrypt) lives in `pdfRecipes.ts` (pdf-lib).
 */
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

/* --------------------------------- Constants ------------------------------ */

export const LETTER = { width: 612, height: 792 } as const; // pt
export const MARGINS = { top: 64, right: 72, bottom: 64, left: 72 } as const;
export const CONTENT_WIDTH = LETTER.width - MARGINS.left - MARGINS.right;

export const PALETTE = {
  text: [20, 20, 20] as [number, number, number],
  muted: [110, 110, 110] as [number, number, number],
  faint: [160, 160, 160] as [number, number, number],
  rule: [220, 220, 220] as [number, number, number],
  primary: [40, 60, 90] as [number, number, number],
};

export const FONT = {
  family: "helvetica" as const,
  h1: 20,
  h2: 14,
  h3: 12,
  body: 10,
  caption: 9,
  footer: 8,
};

export const TABLE_DEFAULTS = {
  styles: { fontSize: 9, cellPadding: 4, overflow: "linebreak" as const },
  headStyles: { fillColor: PALETTE.primary, textColor: [255, 255, 255] as [number, number, number] },
  theme: "striped" as const,
};

/* --------------------------------- Sanitize ------------------------------- */

/** Replace characters not in jsPDF's WinAnsi encoding with safe ASCII equivalents.
 *  Without this, a single non-WinAnsi char (arrows, em-dashes, smart quotes,
 *  unicode bullets, sub/superscript glyphs) corrupts the entire text line. */
const WIN_ANSI_REPLACE: Record<string, string> = {
  "\u2194": "<->", "\u2190": "<-", "\u2192": "->", "\u2191": "^", "\u2193": "v",
  "\u2013": "-", "\u2014": "-", "\u2212": "-",
  "\u2018": "'", "\u2019": "'", "\u201A": "'", "\u201B": "'",
  "\u201C": '"', "\u201D": '"', "\u201E": '"',
  "\u2026": "...", "\u2022": "*", "\u00B7": "-",
  "\u00A0": " ", "\u200B": "", "\u200C": "", "\u200D": "", "\uFEFF": "",
  "\u2122": "(TM)", "\u00AE": "(R)", "\u00A9": "(C)",
  "\u00D7": "x", "\u2713": "v", "\u2717": "x",
};

export function sanitizeForPdf(input: string | null | undefined): string {
  if (!input) return "";
  // Strip unicode subscript/superscript ranges entirely (skill rule — no glyphs in built-in fonts).
  let out = input.replace(/[\u2070-\u209F]/g, "");
  out = out.replace(
    /[\u2194\u2190\u2192\u2191\u2193\u2013\u2014\u2212\u2018\u2019\u201A\u201B\u201C\u201D\u201E\u2026\u2022\u00B7\u00A0\u200B\u200C\u200D\uFEFF\u2122\u00AE\u00A9\u00D7\u2713\u2717]/g,
    (c) => WIN_ANSI_REPLACE[c] ?? "",
  );
  // Final guard — drop anything outside WinAnsi
  out = out.replace(/[^\x09\x0A\x0D\x20-\x7E\xA1-\xFF]/g, "?");
  return out;
}

/* --------------------------------- Filenames ------------------------------ */

function pad(n: number) { return String(n).padStart(2, "0"); }
function timestamp(d = new Date()) {
  return `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}-${pad(d.getHours())}${pad(d.getMinutes())}`;
}

export function slugifyFilename(parts: Array<string | null | undefined>, ext = "pdf"): string {
  const slugParts = parts
    .filter(Boolean)
    .map((p) =>
      String(p)
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/(^-|-$)/g, "")
        .slice(0, 50),
    )
    .filter((p) => p.length > 0);
  if (slugParts.length === 0) slugParts.push("document");
  return `${slugParts.join("-")}-${timestamp()}.${ext.replace(/^\./, "")}`;
}

/* --------------------------------- Doc setup ------------------------------ */

export interface CreatePdfOptions {
  title?: string;
  subject?: string;
  author?: string;
  keywords?: string;
}

export function createPdf(opts: CreatePdfOptions = {}): jsPDF {
  const doc = new jsPDF({ unit: "pt", format: "letter" });
  doc.setProperties({
    title: opts.title ?? "Document",
    subject: opts.subject ?? "",
    author: opts.author ?? "Solicitation IQ",
    keywords: opts.keywords ?? "",
    creator: "Solicitation IQ",
  });
  return doc;
}

/* --------------------------------- Drawing -------------------------------- */

export interface DrawHeaderOptions {
  title: string;
  subtitle?: string;
  meta?: string[]; // small grey lines under subtitle
}

export function drawHeader(doc: jsPDF, opts: DrawHeaderOptions, startY = MARGINS.top): number {
  let y = startY;
  doc.setFont(FONT.family, "bold");
  doc.setFontSize(FONT.h1);
  doc.setTextColor(...PALETTE.text);
  doc.text(sanitizeForPdf(opts.title), MARGINS.left, y);
  y += FONT.h1 + 6;
  if (opts.subtitle) {
    doc.setFont(FONT.family, "normal");
    doc.setFontSize(FONT.body);
    doc.setTextColor(...PALETTE.muted);
    doc.text(sanitizeForPdf(opts.subtitle), MARGINS.left, y);
    y += FONT.body + 6;
  }
  if (opts.meta?.length) {
    doc.setFontSize(FONT.caption);
    doc.setTextColor(...PALETTE.faint);
    for (const line of opts.meta) {
      doc.text(sanitizeForPdf(line), MARGINS.left, y);
      y += FONT.caption + 3;
    }
  }
  doc.setTextColor(...PALETTE.text);
  return y + 6;
}

export interface StampFooterOptions {
  left?: string;
  center?: string;
  showPageNumbers?: boolean;
  skipPages?: number[]; // 1-indexed pages to skip (e.g. cover)
}

/** Iterates over every page and stamps the footer. Call once just before save. */
export function stampPageNumbers(doc: jsPDF, opts: StampFooterOptions = {}): void {
  const total = doc.getNumberOfPages();
  const showPN = opts.showPageNumbers !== false;
  const skip = new Set(opts.skipPages ?? []);
  const y = LETTER.height - MARGINS.bottom / 2 - 4;
  for (let p = 1; p <= total; p++) {
    if (skip.has(p)) continue;
    doc.setPage(p);
    doc.setFont(FONT.family, "normal");
    doc.setFontSize(FONT.footer);
    doc.setTextColor(...PALETTE.muted);
    if (opts.left) doc.text(sanitizeForPdf(opts.left), MARGINS.left, y);
    if (opts.center) doc.text(sanitizeForPdf(opts.center), LETTER.width / 2, y, { align: "center" });
    if (showPN) {
      doc.text(`Page ${p} of ${total}`, LETTER.width - MARGINS.right, y, { align: "right" });
    }
  }
}

/* --------------------------------- Text ----------------------------------- */

export interface WriteWrappedOptions {
  size?: number;
  bold?: boolean;
  italic?: boolean;
  color?: [number, number, number];
  indent?: number;
  gap?: number;
  maxWidth?: number;
}

/** Write wrapped text with auto page-break. Returns updated `y`. */
export function writeWrapped(
  doc: jsPDF,
  text: string,
  y: number,
  opts: WriteWrappedOptions = {},
): number {
  if (!text) return y;
  const size = opts.size ?? FONT.body;
  const indent = opts.indent ?? 0;
  const maxW = opts.maxWidth ?? CONTENT_WIDTH - indent;
  const style = opts.bold && opts.italic ? "bolditalic" : opts.bold ? "bold" : opts.italic ? "italic" : "normal";
  doc.setFont(FONT.family, style as "normal" | "bold" | "italic" | "bolditalic");
  doc.setFontSize(size);
  doc.setTextColor(...(opts.color ?? PALETTE.text));
  const lines = doc.splitTextToSize(sanitizeForPdf(text), maxW);
  const lineH = size * 1.35;
  const contentBottom = LETTER.height - MARGINS.bottom;
  for (const line of lines) {
    if (y + lineH > contentBottom) {
      doc.addPage();
      y = MARGINS.top;
    }
    doc.text(line, MARGINS.left + indent, y);
    y += lineH;
  }
  return y + (opts.gap ?? 4);
}

/* --------------------------------- Tables --------------------------------- */

export interface DrawTableOptions {
  head: string[][];
  body: (string | number)[][];
  startY: number;
  columnStyles?: Record<number, { cellWidth?: number | "auto"; halign?: "left" | "center" | "right" }>;
  headFillColor?: [number, number, number];
}

/** Wraps jspdf-autotable with skill-aligned defaults. Returns the y after the table. */
export function drawTable(doc: jsPDF, opts: DrawTableOptions): number {
  autoTable(doc, {
    startY: opts.startY,
    head: opts.head,
    body: opts.body.map((row) => row.map((cell) => sanitizeForPdf(String(cell ?? "")))),
    margin: { left: MARGINS.left, right: MARGINS.right },
    styles: TABLE_DEFAULTS.styles,
    headStyles: { ...TABLE_DEFAULTS.headStyles, fillColor: opts.headFillColor ?? TABLE_DEFAULTS.headStyles.fillColor },
    theme: TABLE_DEFAULTS.theme,
    columnStyles: opts.columnStyles,
  });
  const lastY = (doc as unknown as { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY;
  return (lastY ?? opts.startY) + 8;
}

/* --------------------------------- Save ----------------------------------- */

export function savePdf(doc: jsPDF, filenameParts: string[], footer?: StampFooterOptions): void {
  if (footer) stampPageNumbers(doc, footer);
  doc.save(slugifyFilename(filenameParts));
}
