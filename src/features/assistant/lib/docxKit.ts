/**
 * docxKit — single chokepoint for AI Assistant → Word (.docx) output.
 *
 * Codifies the rules from the `docx` agent skill so every Word file the
 * assistant produces follows the same standards:
 *   - US Letter page size (docx-js defaults to A4 — never rely on that).
 *   - Real numbered/bulleted lists via LevelFormat (never literal "•" runs).
 *   - Tables with both columnWidths AND per-cell width in DXA.
 *   - ShadingType.CLEAR (never SOLID).
 *   - Each markdown newline → its own Paragraph (no "\n" in TextRun).
 *   - ImageRun always carries an explicit `type`.
 *
 * Other modules SHOULD call buildPlainDocx + saveDocx rather than
 * constructing `new Document(...)` themselves.
 */
import React from "react";
import { createRoot } from "react-dom/client";
import { saveAs } from "file-saver";
import {
  Document,
  Packer,
  Paragraph,
  HeadingLevel,
  TextRun,
  Table,
  Header,
  Footer,
  PageNumber,
  AlignmentType,
  BorderStyle,
} from "docx";

import { AssistantMessageBody } from "../components/AssistantMessageBody";
import { NUMBERING_CONFIG, blockFromElement } from "./exportFormatted";

/* ----------------------------- Constants ----------------------------- */

/** US Letter, 1" margins. DXA = 1440 per inch. */
export const LETTER_SECTION_PROPERTIES = {
  page: {
    size: { width: 12240, height: 15840 },
    margin: { top: 1440, right: 1440, bottom: 1440, left: 1440 },
  },
} as const;

/** Shared bullet/number numbering config. */
export const STANDARD_NUMBERING = NUMBERING_CONFIG;

/* --------------------------- Markdown → blocks --------------------------- */

/**
 * Render assistant markdown to docx blocks (Paragraph | Table). Uses an
 * offscreen DOM render of the same component the chat uses so headings,
 * lists, code, blockquotes and tables come out identically.
 */
export async function markdownToDocxBlocks(md: string): Promise<(Paragraph | Table)[]> {
  if (!md || !md.trim()) return [];
  const host = document.createElement("div");
  host.style.position = "fixed";
  host.style.left = "-10000px";
  host.style.top = "0";
  host.style.width = "800px";
  host.style.opacity = "0";
  host.style.pointerEvents = "none";
  document.body.appendChild(host);

  const root = createRoot(host);
  root.render(React.createElement(AssistantMessageBody, { text: md }));

  // Let React commit + paint.
  await new Promise((r) => requestAnimationFrame(() => r(null)));
  await new Promise((r) => requestAnimationFrame(() => r(null)));

  const blocks: (Paragraph | Table)[] = [];
  try {
    // AssistantMessageBody wraps everything in a single prose div.
    const proseRoot = host.firstElementChild as HTMLElement | null;
    const walkTarget = proseRoot ?? host;
    walkTarget.childNodes.forEach((c) => {
      if (c.nodeType === Node.ELEMENT_NODE) {
        blocks.push(...blockFromElement(c as HTMLElement));
      } else if (c.nodeType === Node.TEXT_NODE) {
        const t = (c.nodeValue ?? "").trim();
        if (t) blocks.push(new Paragraph({ children: [new TextRun(t)] }));
      }
    });
  } finally {
    root.unmount();
    host.remove();
  }
  return blocks;
}

/* ------------------------------ Builder ------------------------------ */

export interface BuildPlainDocxOptions {
  title: string;
  subtitle?: string;
  blocks: (Paragraph | Table)[];
  footerText?: string;
}

/**
 * Assemble a plain, brand-free Document with standard page setup,
 * numbering, default fonts, and page-number footer.
 */
export function buildPlainDocx(opts: BuildPlainDocxOptions): Document {
  const { title, subtitle, blocks, footerText } = opts;

  const headChildren: (Paragraph | Table)[] = [
    new Paragraph({
      heading: HeadingLevel.HEADING_1,
      spacing: { after: 120 },
      children: [new TextRun(title)],
    }),
  ];
  if (subtitle) {
    headChildren.push(
      new Paragraph({
        spacing: { before: 0, after: 120 },
        children: [new TextRun({ text: subtitle, color: "6B7280", size: 20 })],
      }),
    );
  }
  headChildren.push(
    new Paragraph({
      spacing: { before: 40, after: 200 },
      border: { bottom: { color: "E5E7EB", space: 1, style: BorderStyle.SINGLE, size: 6 } },
      children: [],
    }),
  );

  return new Document({
    numbering: STANDARD_NUMBERING,
    styles: {
      default: {
        document: { run: { font: "Calibri", size: 22 } },
      },
    },
    sections: [
      {
        properties: LETTER_SECTION_PROPERTIES,
        headers: {
          default: new Header({
            children: [
              new Paragraph({
                alignment: AlignmentType.RIGHT,
                children: [new TextRun({ text: title, color: "9CA3AF", size: 18 })],
              }),
            ],
          }),
        },
        footers: {
          default: new Footer({
            children: [
              new Paragraph({
                alignment: AlignmentType.CENTER,
                children: [
                  ...(footerText
                    ? [new TextRun({ text: `${footerText}  ·  `, color: "9CA3AF", size: 18 })]
                    : []),
                  new TextRun({ text: "Page ", color: "9CA3AF", size: 18 }),
                  new TextRun({ children: [PageNumber.CURRENT], color: "9CA3AF", size: 18 }),
                  new TextRun({ text: " of ", color: "9CA3AF", size: 18 }),
                  new TextRun({ children: [PageNumber.TOTAL_PAGES], color: "9CA3AF", size: 18 }),
                ],
              }),
            ],
          }),
        },
        children: [...headChildren, ...blocks],
      },
    ],
  });
}

/* ------------------------------ Save ------------------------------ */

export function slugifyFilename(s: string, fallback = "document"): string {
  const slug = (s || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "")
    .slice(0, 60);
  return slug || fallback;
}

export async function saveDocx(doc: Document, filename: string): Promise<void> {
  const blob = await Packer.toBlob(doc);
  const safe = filename.toLowerCase().endsWith(".docx") ? filename : `${filename}.docx`;
  saveAs(blob, safe);
}
