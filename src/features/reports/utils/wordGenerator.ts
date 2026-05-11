import {
  Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell,
  Header, Footer, AlignmentType, BorderStyle, WidthType, ShadingType,
  HeadingLevel, PageNumber, VerticalAlign, LevelFormat,
} from "docx";
import type { ReportContent } from "../templates/types";
import { sectionBlocks, type Block } from "../templates/blocks";
import { HEX, FONT_DOCX, DEFAULT_FOOTER_TEXT } from "../templates/theme";

function fmt(d: string) {
  try { return new Date(d).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" }); }
  catch { return d; }
}

function stripMd(s: string) {
  return s.replace(/\*\*(.+?)\*\*/g, "$1").replace(/\*(.+?)\*/g, "$1").replace(/`(.+?)`/g, "$1");
}

const noBorder = { style: BorderStyle.NONE, size: 0, color: "FFFFFF" };
const noBorders = { top: noBorder, bottom: noBorder, left: noBorder, right: noBorder, insideHorizontal: noBorder, insideVertical: noBorder };
const lightBorder = { style: BorderStyle.SINGLE, size: 4, color: HEX.border };
const lightBorders = { top: lightBorder, bottom: lightBorder, left: lightBorder, right: lightBorder, insideHorizontal: lightBorder, insideVertical: lightBorder };

const CONTENT_W = 9360; // US Letter, 1" margins (DXA)

// ---------- Block renderers (each returns Paragraph[] | Table) ----------

function paragraphRun(text: string, opts: { bold?: boolean; italics?: boolean; size?: number; color?: string } = {}) {
  return new TextRun({
    text: stripMd(text),
    bold: opts.bold,
    italics: opts.italics,
    size: opts.size ?? 22, // 11pt
    color: opts.color ?? HEX.text,
    font: FONT_DOCX,
  });
}

function plainParagraph(text: string, opts: { bold?: boolean; italics?: boolean; size?: number; color?: string; align?: typeof AlignmentType[keyof typeof AlignmentType] } = {}) {
  return new Paragraph({
    alignment: opts.align,
    spacing: { after: 120 },
    children: [paragraphRun(text, opts)],
  });
}

function sectionHeading(text: string) {
  return new Paragraph({
    spacing: { before: 320, after: 80 },
    border: { bottom: { style: BorderStyle.SINGLE, size: 8, color: HEX.amber, space: 4 } },
    children: [new TextRun({ text: text.toUpperCase(), bold: true, size: 26, color: HEX.navy, font: FONT_DOCX })],
  });
}

function bulletParagraph(text: string) {
  return new Paragraph({
    bullet: { level: 0 },
    spacing: { after: 80 },
    children: [paragraphRun(text)],
  });
}

function kvTable(rows: Array<[string, string]>) {
  const labelW = 2700;
  const valueW = CONTENT_W - labelW;
  return new Table({
    width: { size: CONTENT_W, type: WidthType.DXA },
    columnWidths: [labelW, valueW],
    borders: lightBorders,
    rows: rows.map(([k, v], i) => new TableRow({
      children: [
        new TableCell({
          width: { size: labelW, type: WidthType.DXA },
          shading: { fill: HEX.navy, type: ShadingType.CLEAR, color: "auto" },
          margins: { top: 120, bottom: 120, left: 160, right: 120 },
          verticalAlign: VerticalAlign.CENTER,
          children: [new Paragraph({ children: [new TextRun({ text: k, bold: true, size: 22, color: HEX.white, font: FONT_DOCX })] })],
        }),
        new TableCell({
          width: { size: valueW, type: WidthType.DXA },
          shading: { fill: i % 2 === 0 ? HEX.white : HEX.rowAlt, type: ShadingType.CLEAR, color: "auto" },
          margins: { top: 120, bottom: 120, left: 160, right: 120 },
          verticalAlign: VerticalAlign.CENTER,
          children: [new Paragraph({ children: [paragraphRun(v)] })],
        }),
      ],
    })),
  });
}

function categoryTable(b: Extract<Block, { kind: "category" }>) {
  const headerColor = b.tone === "opportunity" ? HEX.oppGreen : b.tone === "risk" ? HEX.riskRed : HEX.navy;
  const tintColor = b.tone === "opportunity" ? HEX.oppTint : b.tone === "risk" ? HEX.riskTint : HEX.lightBlue;
  const titleW = 3200;
  const descW = CONTENT_W - titleW;

  const headerRow = new TableRow({
    children: [
      new TableCell({
        width: { size: CONTENT_W, type: WidthType.DXA },
        columnSpan: 2,
        shading: { fill: headerColor, type: ShadingType.CLEAR, color: "auto" },
        margins: { top: 120, bottom: 120, left: 160, right: 160 },
        children: [new Paragraph({ children: [new TextRun({ text: b.title.toUpperCase(), bold: true, size: 22, color: HEX.white, font: FONT_DOCX })] })],
      }),
    ],
  });

  const dataRows = b.rows.map(([title, desc]) => new TableRow({
    children: [
      new TableCell({
        width: { size: titleW, type: WidthType.DXA },
        shading: { fill: tintColor, type: ShadingType.CLEAR, color: "auto" },
        margins: { top: 140, bottom: 140, left: 160, right: 120 },
        verticalAlign: VerticalAlign.CENTER,
        children: [new Paragraph({ children: [new TextRun({ text: title, bold: true, size: 22, color: headerColor, font: FONT_DOCX })] })],
      }),
      new TableCell({
        width: { size: descW, type: WidthType.DXA },
        shading: { fill: HEX.white, type: ShadingType.CLEAR, color: "auto" },
        margins: { top: 140, bottom: 140, left: 160, right: 160 },
        verticalAlign: VerticalAlign.CENTER,
        children: [new Paragraph({ children: [paragraphRun(desc)] })],
      }),
    ],
  }));

  return new Table({
    width: { size: CONTENT_W, type: WidthType.DXA },
    columnWidths: [titleW, descW],
    borders: lightBorders,
    rows: [headerRow, ...dataRows],
  });
}

function recommendationTable(verdict: string, rationale: string) {
  const amberBorder = { style: BorderStyle.SINGLE, size: 12, color: HEX.amber };
  return new Table({
    width: { size: CONTENT_W, type: WidthType.DXA },
    columnWidths: [CONTENT_W],
    borders: { top: amberBorder, bottom: amberBorder, left: amberBorder, right: amberBorder, insideHorizontal: amberBorder, insideVertical: amberBorder },
    rows: [new TableRow({
      children: [new TableCell({
        width: { size: CONTENT_W, type: WidthType.DXA },
        shading: { fill: HEX.cream, type: ShadingType.CLEAR, color: "auto" },
        margins: { top: 280, bottom: 280, left: 280, right: 280 },
        children: [
          new Paragraph({
            alignment: AlignmentType.CENTER,
            spacing: { after: 60 },
            children: [new TextRun({ text: "RECOMMENDATION", bold: true, size: 18, color: HEX.textMuted, font: FONT_DOCX })],
          }),
          new Paragraph({
            alignment: AlignmentType.CENTER,
            spacing: { after: 200 },
            children: [new TextRun({ text: verdict.toUpperCase(), bold: true, size: 40, color: HEX.navy, font: FONT_DOCX })],
          }),
          new Paragraph({
            alignment: AlignmentType.CENTER,
            children: [new TextRun({ text: stripMd(rationale), italics: true, size: 22, color: HEX.text, font: FONT_DOCX })],
          }),
        ],
      })],
    })],
  });
}

function stepsTable(items: Array<{ title: string; detail: string }>) {
  const numW = 700;
  const titleW = 2800;
  const detailW = CONTENT_W - numW - titleW;
  return new Table({
    width: { size: CONTENT_W, type: WidthType.DXA },
    columnWidths: [numW, titleW, detailW],
    borders: lightBorders,
    rows: items.map((it, i) => new TableRow({
      children: [
        new TableCell({
          width: { size: numW, type: WidthType.DXA },
          shading: { fill: HEX.navy, type: ShadingType.CLEAR, color: "auto" },
          margins: { top: 200, bottom: 200, left: 80, right: 80 },
          verticalAlign: VerticalAlign.CENTER,
          children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: String(i + 1).padStart(2, "0"), bold: true, size: 28, color: HEX.white, font: FONT_DOCX })] })],
        }),
        new TableCell({
          width: { size: titleW, type: WidthType.DXA },
          shading: { fill: HEX.lightBlue, type: ShadingType.CLEAR, color: "auto" },
          margins: { top: 200, bottom: 200, left: 160, right: 120 },
          verticalAlign: VerticalAlign.CENTER,
          children: [new Paragraph({ children: [new TextRun({ text: it.title, bold: true, size: 22, color: HEX.navy, font: FONT_DOCX })] })],
        }),
        new TableCell({
          width: { size: detailW, type: WidthType.DXA },
          shading: { fill: HEX.white, type: ShadingType.CLEAR, color: "auto" },
          margins: { top: 200, bottom: 200, left: 160, right: 160 },
          verticalAlign: VerticalAlign.CENTER,
          children: [new Paragraph({ children: [paragraphRun(it.detail)] })],
        }),
      ],
    })),
  });
}

function coverBand(content: ReportContent) {
  const meta = [content.subtitle, `Generated ${fmt(content.generatedAt)}`].filter(Boolean).join("   •   ");
  return new Table({
    width: { size: CONTENT_W, type: WidthType.DXA },
    columnWidths: [CONTENT_W],
    borders: { top: noBorder, bottom: noBorder, left: noBorder, right: noBorder, insideHorizontal: noBorder, insideVertical: noBorder },
    rows: [new TableRow({
      children: [new TableCell({
        width: { size: CONTENT_W, type: WidthType.DXA },
        shading: { fill: HEX.navy, type: ShadingType.CLEAR, color: "auto" },
        margins: { top: 360, bottom: 360, left: 360, right: 360 },
        children: [
          new Paragraph({
            spacing: { after: 80 },
            children: [new TextRun({ text: "EXECUTIVE REPORT", bold: true, size: 18, color: HEX.amber, font: FONT_DOCX })],
          }),
          new Paragraph({
            spacing: { after: 160 },
            children: [new TextRun({ text: content.title, bold: true, size: 44, color: HEX.white, font: FONT_DOCX })],
          }),
          new Paragraph({
            children: [new TextRun({ text: meta, size: 22, color: HEX.white, font: FONT_DOCX })],
          }),
        ],
      })],
    })],
  });
}

// ---------- Block dispatch ----------

function blockToElements(b: Block): Array<Paragraph | Table> {
  switch (b.kind) {
    case "paragraph":
      return [plainParagraph(b.text)];
    case "bullets":
      return b.items.map((i) => bulletParagraph(i));
    case "kv":
      return [kvTable(b.rows), new Paragraph({ children: [new TextRun("")] })];
    case "category":
      return [categoryTable(b), new Paragraph({ children: [new TextRun("")] })];
    case "recommendation":
      return [recommendationTable(b.verdict, b.rationale), new Paragraph({ children: [new TextRun("")] })];
    case "steps":
      return [stepsTable(b.items), new Paragraph({ children: [new TextRun("")] })];
  }
}

// ---------- Document assembly ----------

export async function generateDocx(report: ReportContent): Promise<Blob> {
  const headerLeft = report.branding?.headerText
    || (typeof report.meta?.client === "string" ? report.meta.client : null)
    || report.title;
  const headerRight = (report.subtitle || report.meta?.solicitation_number || "") as string;
  const footerLeft = report.branding?.footerText || DEFAULT_FOOTER_TEXT;

  const headerPara = new Paragraph({
    border: {
      bottom: { style: BorderStyle.SINGLE, size: 6, color: HEX.amber, space: 2 },
    },
    children: [
      new TextRun({ text: headerLeft.toUpperCase(), bold: true, size: 18, color: HEX.navy, font: FONT_DOCX }),
      new TextRun({ text: "   |   ", bold: true, size: 18, color: HEX.amber, font: FONT_DOCX }),
      new TextRun({ text: headerRight.toUpperCase(), size: 18, color: HEX.amber, font: FONT_DOCX }),
    ],
  });

  const footerPara = new Paragraph({
    border: { top: { style: BorderStyle.SINGLE, size: 4, color: HEX.amber, space: 2 } },
    children: [
      new TextRun({ text: footerLeft, size: 16, color: HEX.textMuted, font: FONT_DOCX }),
      new TextRun({ text: "\t\tPage ", size: 16, color: HEX.textMuted, font: FONT_DOCX }),
      new TextRun({ children: [PageNumber.CURRENT], size: 16, color: HEX.textMuted, font: FONT_DOCX }),
    ],
  });

  const children: Array<Paragraph | Table> = [];
  children.push(coverBand(report));
  children.push(new Paragraph({ children: [new TextRun("")], spacing: { after: 200 } }));

  for (const s of report.sections ?? []) {
    children.push(sectionHeading(s.heading));
    const blocks = sectionBlocks(s);
    for (const b of blocks) {
      for (const el of blockToElements(b)) children.push(el);
    }
  }

  if (report.citations?.length) {
    children.push(sectionHeading("Source Citations"));
    report.citations.forEach((c, i) => {
      const id = c.id || `C${i + 1}`;
      children.push(new Paragraph({
        spacing: { after: 40 },
        children: [new TextRun({
          text: `[${id}] ${c.document}${c.section ? ` §${c.section}` : ""}${c.page ? ` p.${c.page}` : ""}`,
          size: 18, color: HEX.text, font: FONT_DOCX,
        })],
      }));
    });
  }

  const doc = new Document({
    styles: {
      default: { document: { run: { font: FONT_DOCX, size: 22 } } },
    },
    numbering: {
      config: [{
        reference: "report-bullets",
        levels: [{
          level: 0, format: LevelFormat.BULLET, text: "•", alignment: AlignmentType.LEFT,
          style: { paragraph: { indent: { left: 720, hanging: 360 } } },
        }],
      }],
    },
    sections: [{
      properties: {
        page: {
          size: { width: 12240, height: 15840 },
          margin: { top: 1080, right: 1440, bottom: 1440, left: 1440, header: 432, footer: 720 },
        },
      },
      headers: { default: new Header({ children: [headerPara] }) },
      footers: { default: new Footer({ children: [footerPara] }) },
      children,
    }],
  });

  return await Packer.toBlob(doc);
}
