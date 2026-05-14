import jsPDF from "jspdf";
import {
  Document,
  Packer,
  Paragraph,
  HeadingLevel,
  TextRun,
  AlignmentType,
} from "docx";
import type { QuestionRow } from "./questionHelpers";

export interface ClarificationContext {
  solicitationTitle: string;
  solicitationNumber?: string | null;
  issuingAgency?: string | null;
  clientName?: string | null;
  preparedBy?: string | null;
  preparedAt?: Date;
}

interface ParsedDraft {
  reference: string;
  quotedText: string;
  concern: string;
  requestedClarification: string;
}

// The edge function stores markdown with labelled sections.
// Parse it back into the four parts, falling back to the whole string under "concern".
export function parseClarificationDraft(md: string | null | undefined): ParsedDraft {
  const out: ParsedDraft = { reference: "", quotedText: "", concern: "", requestedClarification: "" };
  if (!md) return out;
  const grab = (label: string) => {
    const re = new RegExp(`(?:^|\\n)\\s*(?:\\*\\*)?${label}(?:\\*\\*)?\\s*[:\\-]\\s*([\\s\\S]*?)(?=\\n\\s*(?:\\*\\*)?(?:Reference|Quoted Text|Quote|Concern|Requested Clarification|Clarification Requested|Question)(?:\\*\\*)?\\s*[:\\-]|$)`, "i");
    const m = md.match(re);
    return m ? m[1].trim() : "";
  };
  out.reference = grab("Reference");
  out.quotedText = grab("Quoted Text") || grab("Quote");
  out.concern = grab("Concern");
  out.requestedClarification = grab("Requested Clarification") || grab("Clarification Requested") || grab("Question");
  if (!out.reference && !out.quotedText && !out.concern && !out.requestedClarification) {
    out.concern = md.trim();
  }
  return out;
}

function fmtDate(d: Date) {
  return d.toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });
}

// ---------------- PDF ----------------

const PAGE = { w: 612, h: 792 };
const MARGIN = { top: 64, right: 56, bottom: 64, left: 56 };
const CONTENT_W = PAGE.w - MARGIN.left - MARGIN.right;

export function generateClarificationPdf(
  questions: QuestionRow[],
  ctx: ClarificationContext,
  docMap: Record<string, string> = {},
): Blob {
  const doc = new jsPDF({ unit: "pt", format: "letter" });
  const preparedAt = ctx.preparedAt ?? new Date();
  let y = MARGIN.top;
  let page = 1;

  const ensureSpace = (h: number) => {
    if (y + h > PAGE.h - MARGIN.bottom) {
      drawFooter();
      doc.addPage();
      page += 1;
      y = MARGIN.top;
    }
  };

  const drawFooter = () => {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(120);
    doc.text(
      `${ctx.solicitationTitle}${ctx.solicitationNumber ? ` · ${ctx.solicitationNumber}` : ""}`,
      MARGIN.left,
      PAGE.h - 32
    );
    doc.text(`Page ${page}`, PAGE.w - MARGIN.right, PAGE.h - 32, { align: "right" });
    doc.setTextColor(0);
  };

  const writeWrapped = (text: string, opts: { size: number; bold?: boolean; color?: number; gap?: number }) => {
    if (!text) return;
    doc.setFont("helvetica", opts.bold ? "bold" : "normal");
    doc.setFontSize(opts.size);
    doc.setTextColor(opts.color ?? 0);
    const lines = doc.splitTextToSize(text, CONTENT_W);
    const lineH = opts.size * 1.35;
    for (const line of lines) {
      ensureSpace(lineH);
      doc.text(line, MARGIN.left, y);
      y += lineH;
    }
    y += opts.gap ?? 4;
  };

  // ---- Cover ----
  doc.setFont("helvetica", "bold");
  doc.setFontSize(20);
  doc.text("Request for Clarification", MARGIN.left, y);
  y += 28;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(11);
  doc.setTextColor(80);
  if (ctx.issuingAgency) {
    doc.text(`To: ${ctx.issuingAgency}`, MARGIN.left, y); y += 16;
  }
  doc.text(`Solicitation: ${ctx.solicitationTitle}`, MARGIN.left, y); y += 16;
  if (ctx.solicitationNumber) { doc.text(`Number: ${ctx.solicitationNumber}`, MARGIN.left, y); y += 16; }
  if (ctx.clientName) { doc.text(`From: ${ctx.clientName}`, MARGIN.left, y); y += 16; }
  doc.text(`Date: ${fmtDate(preparedAt)}`, MARGIN.left, y); y += 24;
  doc.setTextColor(0);

  writeWrapped(
    `The following items request clarification on the referenced solicitation. Each item identifies the source location, quotes the relevant text, describes the concern, and states the specific clarification requested.`,
    { size: 10, color: 60, gap: 18 }
  );

  // ---- Items ----
  questions.forEach((q, idx) => {
    const parsed = parseClarificationDraft(q.clarification_draft);
    ensureSpace(60);
    writeWrapped(`Item ${idx + 1}`, { size: 13, bold: true, gap: 6 });
    writeWrapped(q.question_text, { size: 11, color: 30, gap: 10 });

    const sectionRef = parsed.reference || q.source_citation || "";
    if (sectionRef) {
      writeWrapped("Section", { size: 10, bold: true, color: 90, gap: 2 });
      writeWrapped(sectionRef, { size: 10, gap: 6 });
    }
    const docName = q.source_document_id ? (docMap[q.source_document_id] ?? "(unknown document)") : "Not specified";
    writeWrapped("Document", { size: 10, bold: true, color: 90, gap: 2 });
    writeWrapped(docName, { size: 10, gap: 8 });
    if (parsed.quotedText || q.source_quote) {
      writeWrapped("Quoted Text", { size: 10, bold: true, color: 90, gap: 2 });
      writeWrapped(`"${parsed.quotedText || q.source_quote}"`, { size: 10, color: 50, gap: 8 });
    }
    if (parsed.concern) {
      writeWrapped("Concern", { size: 10, bold: true, color: 90, gap: 2 });
      writeWrapped(parsed.concern, { size: 10, gap: 8 });
    }
    if (parsed.requestedClarification) {
      writeWrapped("Requested Clarification", { size: 10, bold: true, color: 90, gap: 2 });
      writeWrapped(parsed.requestedClarification, { size: 10, gap: 14 });
    }

    // Divider
    ensureSpace(14);
    doc.setDrawColor(220);
    doc.setLineWidth(0.5);
    doc.line(MARGIN.left, y, PAGE.w - MARGIN.right, y);
    y += 14;
  });

  drawFooter();
  return doc.output("blob");
}

// ---------------- DOCX ----------------

function p(text: string, opts: { bold?: boolean; size?: number; color?: string; spacing?: number } = {}) {
  return new Paragraph({
    spacing: { after: opts.spacing ?? 120 },
    children: [
      new TextRun({
        text,
        bold: opts.bold,
        size: opts.size ?? 22,
        color: opts.color,
      }),
    ],
  });
}

export async function generateClarificationDocx(
  questions: QuestionRow[],
  ctx: ClarificationContext,
  docMap: Record<string, string> = {},
): Promise<Blob> {
  const preparedAt = ctx.preparedAt ?? new Date();

  const children: Paragraph[] = [
    new Paragraph({
      heading: HeadingLevel.TITLE,
      alignment: AlignmentType.LEFT,
      spacing: { after: 240 },
      children: [new TextRun({ text: "Request for Clarification", bold: true, size: 40 })],
    }),
  ];

  if (ctx.issuingAgency) children.push(p(`To: ${ctx.issuingAgency}`, { color: "555555" }));
  children.push(p(`Solicitation: ${ctx.solicitationTitle}`, { color: "555555" }));
  if (ctx.solicitationNumber) children.push(p(`Number: ${ctx.solicitationNumber}`, { color: "555555" }));
  if (ctx.clientName) children.push(p(`From: ${ctx.clientName}`, { color: "555555" }));
  children.push(p(`Date: ${fmtDate(preparedAt)}`, { color: "555555", spacing: 240 }));

  children.push(
    p(
      "The following items request clarification on the referenced solicitation. Each item identifies the source location, quotes the relevant text, describes the concern, and states the specific clarification requested.",
      { color: "555555", spacing: 320 }
    )
  );

  questions.forEach((q, idx) => {
    const parsed = parseClarificationDraft(q.clarification_draft);
    children.push(
      new Paragraph({
        heading: HeadingLevel.HEADING_2,
        spacing: { before: 280, after: 120 },
        children: [new TextRun({ text: `Item ${idx + 1}`, bold: true })],
      })
    );
    children.push(p(q.question_text, { size: 22, spacing: 200 }));

    const block = (label: string, body: string) => {
      if (!body) return;
      children.push(p(label, { bold: true, size: 20, color: "666666", spacing: 60 }));
      children.push(p(body, { size: 20, spacing: 200 }));
    };
    block("Reference", parsed.reference || q.source_citation || "");
    block("Quoted Text", parsed.quotedText ? `"${parsed.quotedText}"` : q.source_quote ? `"${q.source_quote}"` : "");
    block("Concern", parsed.concern);
    block("Requested Clarification", parsed.requestedClarification);
  });

  const docx = new Document({ sections: [{ children }] });
  return await Packer.toBlob(docx);
}
