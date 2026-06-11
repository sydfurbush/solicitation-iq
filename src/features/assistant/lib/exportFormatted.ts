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
  TableRow,
  TableCell,
  WidthType,
  AlignmentType,
  Header,
  Footer,
  PageNumber,
  BorderStyle,
  LevelFormat,
  ShadingType,
  ImageRun,
  ExternalHyperlink,
} from "docx";

import type { AssistantMessage, AssistantThread } from "../hooks/useAssistantThreads";
import { TranscriptDocument } from "../components/TranscriptDocument";

/* ----------------------------- Render helpers ----------------------------- */

const PRINT_CSS = `
  :root { color-scheme: light; }
  * { box-sizing: border-box; }
  body {
    font-family: ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
    color: #111827;
    background: #ffffff;
    margin: 0;
    padding: 32px 40px;
    font-size: 13px;
    line-height: 1.55;
  }
  h1, h2, h3, h4, h5, h6 { color: #111827; font-weight: 600; line-height: 1.25; }
  h1 { font-size: 22px; margin: 0 0 8px; }
  h2 { font-size: 18px; margin: 16px 0 6px; }
  h3 { font-size: 15px; margin: 12px 0 4px; }
  h4 { font-size: 13px; margin: 10px 0 4px; }
  p { margin: 8px 0; }
  hr { border: 0; border-top: 1px solid #e5e7eb; margin: 16px 0; }
  ul, ol { margin: 8px 0; padding-left: 20px; }
  li { margin: 2px 0; }
  ul.contains-task-list { list-style: none; padding-left: 0; }
  li.task-list-item { display: grid; grid-template-columns: auto 1fr; gap: 0 8px; align-items: start; }
  li.task-list-item > input[type=checkbox] { margin-top: 4px; }
  blockquote {
    border-left: 3px solid #d1d5db; padding-left: 12px; color: #4b5563;
    margin: 8px 0; font-style: italic;
  }
  a { color: #2563eb; text-decoration: underline; }
  code {
    background: #f3f4f6; border-radius: 4px; padding: 1px 5px;
    font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
    font-size: 0.88em;
  }
  pre {
    background: #f3f4f6; border: 1px solid #e5e7eb; border-radius: 6px;
    padding: 10px 12px; overflow-x: auto; margin: 10px 0;
    font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
    font-size: 12px; line-height: 1.5; white-space: pre;
  }
  pre code { background: transparent; padding: 0; border-radius: 0; font-size: inherit; }
  table { width: 100%; border-collapse: collapse; margin: 10px 0; font-size: 12px; }
  th, td { border: 1px solid #e5e7eb; padding: 6px 10px; text-align: left; vertical-align: top; }
  thead th { background: #f3f4f6; font-weight: 600; }
  tbody tr:nth-child(even) { background: #fafafa; }
  img, svg { max-width: 100%; height: auto; }

  .transcript-header { margin-bottom: 16px; }
  .transcript-title { font-size: 24px; margin: 0 0 6px; }
  .transcript-meta {
    display: flex; gap: 16px; flex-wrap: wrap;
    color: #4b5563; font-size: 12px;
  }
  .transcript-meta span strong { color: #111827; font-weight: 600; }
  .transcript-turn {
    padding: 12px 0;
    border-bottom: 1px solid #f1f5f9;
    page-break-inside: avoid;
  }
  .transcript-turn:last-child { border-bottom: 0; }
  .transcript-turn-head {
    display: flex; gap: 12px; align-items: baseline;
    font-size: 11px; color: #6b7280; margin-bottom: 4px;
    text-transform: uppercase; letter-spacing: 0.04em;
  }
  .transcript-speaker { font-weight: 700; color: #111827; letter-spacing: 0.06em; }
  .transcript-user-body {
    background: #eff6ff; border: 1px solid #dbeafe; border-radius: 8px;
    padding: 10px 12px; white-space: pre-wrap; font-size: 13px;
  }
  .is-assistant .prose { font-size: 13px; }
  .transcript-citations {
    margin-top: 8px; font-size: 11px; color: #6b7280; font-style: italic;
  }

  /* Org chart cards */
  .org-chart-card {
    border: 1px solid #e5e7eb; border-radius: 8px; padding: 10px 12px;
    background: #ffffff;
  }

  @media print {
    @page { size: Letter; margin: 0.6in; }
    body { padding: 0; }
    .transcript-turn { page-break-inside: avoid; }
  }
`;

/**
 * Render the transcript React tree into a detached DOM and return its HTML
 * once async children (mermaid SVGs) have settled.
 */
async function renderTranscriptDom(
  thread: AssistantThread,
  messages: AssistantMessage[],
): Promise<{ html: string; cleanup: () => void }> {
  const host = document.createElement("div");
  host.style.position = "fixed";
  host.style.left = "-10000px";
  host.style.top = "0";
  host.style.width = "800px";
  host.style.pointerEvents = "none";
  host.style.opacity = "0";
  document.body.appendChild(host);

  const root = createRoot(host);
  root.render(React.createElement(TranscriptDocument, { thread, messages }));

  // Wait for paint + mermaid render. We poll until either all expected
  // mermaid blocks contain an <svg> or a short timeout elapses.
  const expectedMermaid = messages.reduce((n, m) => {
    const text = (m.parts ?? []).map((p) => (p.type === "text" ? p.text ?? "" : "")).join("\n");
    const matches = text.match(/```mermaid/g);
    return n + (matches ? matches.length : 0);
  }, 0);

  const deadline = Date.now() + 4000;
  // eslint-disable-next-line no-constant-condition
  while (true) {
    await new Promise((r) => requestAnimationFrame(() => r(null)));
    if (Date.now() > deadline) break;
    const svgs = host.querySelectorAll("svg").length;
    if (svgs >= expectedMermaid) break;
    await new Promise((r) => setTimeout(r, 80));
  }
  // Final small settle for fonts.
  try {
    await (document as any).fonts?.ready;
  } catch {}

  const html = host.innerHTML;
  const cleanup = () => {
    root.unmount();
    host.remove();
  };
  return { html, host, cleanup } as { html: string; host: HTMLElement; cleanup: () => void };
}

export async function renderTranscriptToHtml(
  thread: AssistantThread,
  messages: AssistantMessage[],
): Promise<{ html: string; bodyHtml: string }> {
  const { html: bodyHtml, cleanup } = await renderTranscriptDom(thread, messages);
  cleanup();
  const title = escapeHtml(thread.title || "Assistant transcript");
  const html = `<!doctype html><html><head><meta charset="utf-8"/><title>${title}</title><style>${PRINT_CSS}</style></head><body>${bodyHtml}</body></html>`;
  return { html, bodyHtml };
}

/* ----------------------------- SVG → PNG ---------------------------------- */

type DocxImage = { data: Uint8Array; width: number; height: number };

async function rasterizeSvg(svg: SVGSVGElement): Promise<DocxImage | null> {
  try {
    // Determine natural width/height from attributes, viewBox, or bounding box.
    const rect = svg.getBoundingClientRect();
    const vb = svg.viewBox?.baseVal;
    let w = svg.width?.baseVal?.value || rect.width || (vb && vb.width) || 800;
    let h = svg.height?.baseVal?.value || rect.height || (vb && vb.height) || 600;
    if (!isFinite(w) || w <= 0) w = 800;
    if (!isFinite(h) || h <= 0) h = Math.round(w * 0.6);

    // Make sure the serialized SVG carries explicit dimensions and the
    // xmlns attribute (some live DOM SVGs omit it).
    const clone = svg.cloneNode(true) as SVGSVGElement;
    clone.setAttribute("xmlns", "http://www.w3.org/2000/svg");
    if (!clone.getAttribute("width")) clone.setAttribute("width", String(w));
    if (!clone.getAttribute("height")) clone.setAttribute("height", String(h));

    const svgString = new XMLSerializer().serializeToString(clone);
    const blob = new Blob([svgString], { type: "image/svg+xml;charset=utf-8" });
    const url = URL.createObjectURL(blob);

    const img = new Image();
    img.crossOrigin = "anonymous";
    const loaded = new Promise<HTMLImageElement>((resolve, reject) => {
      img.onload = () => resolve(img);
      img.onerror = (e) => reject(e);
    });
    img.src = url;
    await loaded;

    const scale = 2;
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(w * scale);
    canvas.height = Math.round(h * scale);
    const ctx = canvas.getContext("2d");
    if (!ctx) {
      URL.revokeObjectURL(url);
      return null;
    }
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    URL.revokeObjectURL(url);

    const dataUrl = canvas.toDataURL("image/png");
    const base64 = dataUrl.split(",")[1] ?? "";
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    return { data: bytes, width: w, height: h };
  } catch {
    return null;
  }
}

async function rasterizeAllSvgs(host: HTMLElement): Promise<void> {
  const svgs = Array.from(host.querySelectorAll("svg"));
  for (const svg of svgs) {
    const img = await rasterizeSvg(svg as SVGSVGElement);
    const placeholder = document.createElement("div");
    if (img) {
      const idx = (window as any).__docxImages.length;
      (window as any).__docxImages.push(img);
      placeholder.setAttribute("data-docx-image", String(idx));
    } else {
      placeholder.setAttribute("data-docx-image", "fallback");
    }
    svg.parentNode?.replaceChild(placeholder, svg);
  }
}


function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) =>
    c === "&" ? "&amp;" : c === "<" ? "&lt;" : c === ">" ? "&gt;" : c === '"' ? "&quot;" : "&#39;",
  );
}

function slugify(s: string): string {
  return (s || "thread")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "")
    .slice(0, 60) || "thread";
}

/* ---------------------------- Copy as rich HTML --------------------------- */

export async function copyFormatted(thread: AssistantThread, messages: AssistantMessage[]) {
  const { html, bodyHtml } = await renderTranscriptToHtml(thread, messages);
  const plain = bodyHtml.replace(/<[^>]+>/g, "").replace(/\s+\n/g, "\n").trim();
  if (typeof ClipboardItem !== "undefined" && navigator.clipboard?.write) {
    await navigator.clipboard.write([
      new ClipboardItem({
        "text/html": new Blob([html], { type: "text/html" }),
        "text/plain": new Blob([plain], { type: "text/plain" }),
      }),
    ]);
    return;
  }
  await navigator.clipboard.writeText(plain);
}

/* --------------------------------- PDF ------------------------------------ */

export async function downloadAssistantPdf(
  thread: AssistantThread,
  messages: AssistantMessage[],
) {
  const { html } = await renderTranscriptToHtml(thread, messages);

  const iframe = document.createElement("iframe");
  iframe.style.position = "fixed";
  iframe.style.right = "0";
  iframe.style.bottom = "0";
  iframe.style.width = "0";
  iframe.style.height = "0";
  iframe.style.border = "0";
  iframe.setAttribute("aria-hidden", "true");
  document.body.appendChild(iframe);

  await new Promise<void>((resolve) => {
    iframe.onload = () => resolve();
    iframe.srcdoc = html;
  });

  // Give the iframe a moment to layout before printing.
  await new Promise((r) => setTimeout(r, 250));
  try {
    iframe.contentWindow?.focus();
    iframe.contentWindow?.print();
  } finally {
    // Remove after the print dialog closes; keep around briefly in case the
    // browser still needs the iframe DOM for the print job.
    setTimeout(() => iframe.remove(), 1000);
  }
}

/* --------------------------------- DOCX ----------------------------------- */

export const NUMBERING_CONFIG = {
  config: [
    {
      reference: "bullets",
      levels: [
        { level: 0, format: LevelFormat.BULLET, text: "\u2022", alignment: AlignmentType.LEFT,
          style: { paragraph: { indent: { left: 720, hanging: 360 } } } },
        { level: 1, format: LevelFormat.BULLET, text: "\u25E6", alignment: AlignmentType.LEFT,
          style: { paragraph: { indent: { left: 1440, hanging: 360 } } } },
        { level: 2, format: LevelFormat.BULLET, text: "\u25AA", alignment: AlignmentType.LEFT,
          style: { paragraph: { indent: { left: 2160, hanging: 360 } } } },
      ],
    },
    {
      reference: "numbers",
      levels: [
        { level: 0, format: LevelFormat.DECIMAL, text: "%1.", alignment: AlignmentType.LEFT,
          style: { paragraph: { indent: { left: 720, hanging: 360 } } } },
        { level: 1, format: LevelFormat.DECIMAL, text: "%2.", alignment: AlignmentType.LEFT,
          style: { paragraph: { indent: { left: 1440, hanging: 360 } } } },
      ],
    },
  ],
};

const HEADING_MAP: Record<string, (typeof HeadingLevel)[keyof typeof HeadingLevel]> = {
  H1: HeadingLevel.HEADING_1,
  H2: HeadingLevel.HEADING_2,
  H3: HeadingLevel.HEADING_3,
  H4: HeadingLevel.HEADING_4,
  H5: HeadingLevel.HEADING_5,
  H6: HeadingLevel.HEADING_6,
};

type RunStyle = {
  bold?: boolean;
  italics?: boolean;
  strike?: boolean;
  underline?: boolean;
  code?: boolean;
  link?: string;
};

function collectRuns(node: Node, style: RunStyle = {}): (TextRun | ExternalHyperlink)[] {
  const runs: (TextRun | ExternalHyperlink)[] = [];
  node.childNodes.forEach((child) => {
    if (child.nodeType === Node.TEXT_NODE) {
      const text = child.nodeValue ?? "";
      if (!text) return;
      const run = new TextRun({
        text,
        bold: style.bold,
        italics: style.italics,
        strike: style.strike,
        underline: style.underline ? {} : undefined,
        font: style.code ? "Consolas" : undefined,
        shading: style.code
          ? { type: ShadingType.CLEAR, color: "auto", fill: "F3F4F6" }
          : undefined,
      });
      if (style.link) {
        runs.push(
          new ExternalHyperlink({
            link: style.link,
            children: [
              new TextRun({
                text,
                style: "Hyperlink",
                bold: style.bold,
                italics: style.italics,
              }),
            ],
          }),
        );
      } else {
        runs.push(run);
      }
      return;
    }
    if (child.nodeType !== Node.ELEMENT_NODE) return;
    const el = child as HTMLElement;
    const tag = el.tagName.toUpperCase();
    if (
      tag === "STYLE" ||
      tag === "SCRIPT" ||
      tag === "NOSCRIPT" ||
      tag === "TEMPLATE" ||
      tag === "SVG" ||
      tag === "BUTTON"
    ) {
      return;
    }
    const next: RunStyle = { ...style };
    if (tag === "STRONG" || tag === "B") next.bold = true;
    if (tag === "EM" || tag === "I") next.italics = true;
    if (tag === "DEL" || tag === "S" || tag === "STRIKE") next.strike = true;
    if (tag === "U") next.underline = true;
    if (tag === "CODE") next.code = true;
    if (tag === "A") next.link = (el as HTMLAnchorElement).getAttribute("href") || undefined;
    if (tag === "BR") {
      runs.push(new TextRun({ text: "", break: 1 }));
      return;
    }
    if (tag === "INPUT" && (el as HTMLInputElement).type === "checkbox") {
      const checked = (el as HTMLInputElement).checked || el.hasAttribute("checked");
      runs.push(new TextRun({ text: (checked ? "\u2611" : "\u2610") + "  " }));
      return;
    }
    runs.push(...collectRuns(el, next));
  });
  return runs;
}

export function blockFromElement(el: HTMLElement): (Paragraph | Table)[] {
  const tag = el.tagName.toUpperCase();

  if (
    tag === "STYLE" ||
    tag === "SCRIPT" ||
    tag === "NOSCRIPT" ||
    tag === "TEMPLATE" ||
    tag === "SVG" ||
    tag === "BUTTON"
  ) {
    return [];
  }

  // SVG → image placeholder injected by rasterizeAllSvgs.
  const imgIdx = el.getAttribute("data-docx-image");
  if (imgIdx !== null) {
    const images = ((window as any).__docxImages ?? []) as DocxImage[];
    if (imgIdx === "fallback") {
      return [
        new Paragraph({
          spacing: { before: 120, after: 120 },
          children: [new TextRun({ text: "[diagram]", italics: true, color: "6B7280" })],
        }),
      ];
    }
    const img = images[Number(imgIdx)];
    if (!img) return [];
    const maxW = 600;
    const scale = img.width > maxW ? maxW / img.width : 1;
    const w = Math.round(img.width * scale);
    const h = Math.round(img.height * scale);
    return [
      new Paragraph({
        spacing: { before: 120, after: 120 },
        children: [
          new ImageRun({
            type: "png",
            data: img.data,
            transformation: { width: w, height: h },
          } as any),
        ],
      }),
    ];
  }


  if (HEADING_MAP[tag]) {
    return [
      new Paragraph({
        heading: HEADING_MAP[tag],
        spacing: { before: 200, after: 100 },
        children: collectRuns(el),
      }),
    ];
  }

  if (tag === "P") {
    const runs = collectRuns(el);
    if (!runs.length) return [];
    return [new Paragraph({ spacing: { before: 80, after: 80 }, children: runs })];
  }

  if (tag === "BLOCKQUOTE") {
    const out: Paragraph[] = [];
    el.childNodes.forEach((c) => {
      if (c.nodeType === Node.ELEMENT_NODE) {
        const runs = collectRuns(c as HTMLElement, { italics: true });
        if (runs.length) {
          out.push(
            new Paragraph({
              indent: { left: 360 },
              spacing: { before: 60, after: 60 },
              border: {
                left: { color: "D1D5DB", space: 8, style: BorderStyle.SINGLE, size: 12 },
              },
              children: runs,
            }),
          );
        }
      }
    });
    if (!out.length) {
      const runs = collectRuns(el, { italics: true });
      if (runs.length) {
        out.push(new Paragraph({ indent: { left: 360 }, children: runs }));
      }
    }
    return out;
  }

  if (tag === "UL" || tag === "OL") {
    return listToParagraphs(el, tag === "OL" ? "numbers" : "bullets", 0);
  }

  if (tag === "PRE") {
    return [codeBlockToTable(el)];
  }

  if (tag === "TABLE") {
    return [htmlTableToDocxTable(el as HTMLTableElement)];
  }

  if (tag === "HR") {
    return [
      new Paragraph({
        spacing: { before: 120, after: 120 },
        border: {
          bottom: { color: "E5E7EB", space: 1, style: BorderStyle.SINGLE, size: 6 },
        },
        children: [],
      }),
    ];
  }

  // Org chart card container — render as a small table with title + bullets.
  if (el.classList.contains("org-chart-card")) {
    return orgCardToBlocks(el);
  }

  if (tag === "DIV" || tag === "SECTION" || tag === "ARTICLE" || tag === "MAIN" || tag === "HEADER") {
    const out: (Paragraph | Table)[] = [];
    el.childNodes.forEach((c) => {
      if (c.nodeType === Node.ELEMENT_NODE) {
        out.push(...blockFromElement(c as HTMLElement));
      } else if (c.nodeType === Node.TEXT_NODE) {
        const t = (c.nodeValue ?? "").trim();
        if (t) out.push(new Paragraph({ children: [new TextRun(t)] }));
      }
    });
    return out;
  }

  // Fallback: treat as paragraph.
  const runs = collectRuns(el);
  if (!runs.length) return [];
  return [new Paragraph({ children: runs })];
}

function listToParagraphs(
  list: HTMLElement,
  reference: "bullets" | "numbers",
  level: number,
): Paragraph[] {
  const out: Paragraph[] = [];
  list.querySelectorAll(":scope > li").forEach((li) => {
    const liEl = li as HTMLElement;
    // Pull immediate inline content (skip nested lists for the main line).
    const inlineNodes: ChildNode[] = [];
    const nestedLists: HTMLElement[] = [];
    liEl.childNodes.forEach((c) => {
      if (c.nodeType === Node.ELEMENT_NODE) {
        const tag = (c as HTMLElement).tagName.toUpperCase();
        if (tag === "UL" || tag === "OL") {
          nestedLists.push(c as HTMLElement);
          return;
        }
      }
      inlineNodes.push(c);
    });
    const wrapper = document.createElement("span");
    inlineNodes.forEach((n) => wrapper.appendChild(n.cloneNode(true)));
    const runs = collectRuns(wrapper);
    out.push(
      new Paragraph({
        numbering: { reference, level },
        spacing: { before: 40, after: 40 },
        children: runs.length ? runs : [new TextRun("")],
      }),
    );
    nestedLists.forEach((nl) => {
      const ref = nl.tagName.toUpperCase() === "OL" ? "numbers" : "bullets";
      out.push(...listToParagraphs(nl, ref, Math.min(level + 1, 2)));
    });
  });
  return out;
}

function codeBlockToTable(pre: HTMLElement): Table {
  const text = pre.textContent ?? "";
  const lines = text.split("\n");
  const paragraphs = lines.map(
    (line) =>
      new Paragraph({
        spacing: { before: 0, after: 0 },
        children: [new TextRun({ text: line || " ", font: "Consolas", size: 18 })],
      }),
  );
  return new Table({
    width: { size: 9360, type: WidthType.DXA },
    columnWidths: [9360],
    rows: [
      new TableRow({
        children: [
          new TableCell({
            width: { size: 9360, type: WidthType.DXA },
            shading: { type: ShadingType.CLEAR, color: "auto", fill: "F3F4F6" },
            margins: { top: 120, bottom: 120, left: 160, right: 160 },
            borders: borderAll("E5E7EB"),
            children: paragraphs,
          }),
        ],
      }),
    ],
  });
}

function borderAll(color: string) {
  const b = { style: BorderStyle.SINGLE, size: 4, color };
  return { top: b, bottom: b, left: b, right: b, insideHorizontal: b, insideVertical: b };
}

function htmlTableToDocxTable(table: HTMLTableElement): Table {
  const allRows = Array.from(table.querySelectorAll("tr"));
  if (!allRows.length) {
    return new Table({
      width: { size: 9360, type: WidthType.DXA },
      columnWidths: [9360],
      rows: [
        new TableRow({
          children: [
            new TableCell({
              width: { size: 9360, type: WidthType.DXA },
              children: [new Paragraph("")],
            }),
          ],
        }),
      ],
    });
  }
  const colCount = Math.max(...allRows.map((r) => r.querySelectorAll("th,td").length));
  const colWidth = Math.floor(9360 / Math.max(colCount, 1));
  const columnWidths = Array(colCount).fill(colWidth);

  const rows = allRows.map((tr) => {
    const cells = Array.from(tr.querySelectorAll("th,td"));
    const isHeader = cells.length > 0 && cells[0].tagName.toUpperCase() === "TH";
    const tableCells = cells.map((cell) => {
      const runs = collectRuns(cell as HTMLElement, { bold: isHeader });
      return new TableCell({
        width: { size: colWidth, type: WidthType.DXA },
        shading: isHeader
          ? { type: ShadingType.CLEAR, color: "auto", fill: "F3F4F6" }
          : undefined,
        margins: { top: 80, bottom: 80, left: 120, right: 120 },
        borders: borderAll("E5E7EB"),
        children: [
          new Paragraph({
            children: runs.length ? runs : [new TextRun("")],
          }),
        ],
      });
    });
    // Pad short rows to column count
    while (tableCells.length < colCount) {
      tableCells.push(
        new TableCell({
          width: { size: colWidth, type: WidthType.DXA },
          borders: borderAll("E5E7EB"),
          children: [new Paragraph("")],
        }),
      );
    }
    return new TableRow({ tableHeader: isHeader, children: tableCells });
  });

  return new Table({
    width: { size: 9360, type: WidthType.DXA },
    columnWidths,
    rows,
  });
}

function orgCardToBlocks(el: HTMLElement): (Paragraph | Table)[] {
  // Org card: title (h*/strong) + meta + bullets list. Walk children.
  const out: (Paragraph | Table)[] = [];
  el.childNodes.forEach((c) => {
    if (c.nodeType === Node.ELEMENT_NODE) {
      out.push(...blockFromElement(c as HTMLElement));
    }
  });
  return out;
}

export async function downloadAssistantDocx(
  thread: AssistantThread,
  messages: AssistantMessage[],
) {
  // Render the transcript into the live DOM so we can rasterize SVGs in place
  // before serializing. This avoids dumping mermaid <style> CSS as raw text.
  const { host, cleanup } = (await renderTranscriptDom(thread, messages)) as {
    host: HTMLElement;
    cleanup: () => void;
    html: string;
  };
  (window as any).__docxImages = [] as DocxImage[];
  try {
    await rasterizeAllSvgs(host);
  } catch {
    /* swallow — fallback placeholders already emitted by rasterizeAllSvgs */
  }
  const container = host;


  const children: (Paragraph | Table)[] = [];

  // Cover header
  children.push(
    new Paragraph({
      heading: HeadingLevel.HEADING_1,
      children: [new TextRun(thread.title || "Assistant transcript")],
    }),
  );
  children.push(
    new Paragraph({
      spacing: { before: 40, after: 40 },
      children: [
        new TextRun({ text: "Persona: ", bold: true }),
        new TextRun(prettyPersona(thread.persona)),
        new TextRun({ text: "   |   Plain mode: ", bold: true }),
        new TextRun(thread.plain_mode ? "on" : "off"),
        new TextRun({ text: "   |   Exported: ", bold: true }),
        new TextRun(new Date().toLocaleString()),
      ],
    }),
  );
  children.push(
    new Paragraph({
      spacing: { before: 80, after: 160 },
      border: { bottom: { color: "E5E7EB", space: 1, style: BorderStyle.SINGLE, size: 6 } },
      children: [],
    }),
  );

  // Walk each turn section produced by TranscriptDocument
  const turns = container.querySelectorAll(":scope > .transcript-document > main > .transcript-turn");
  const turnList = turns.length
    ? Array.from(turns)
    : Array.from(container.querySelectorAll(".transcript-turn"));

  turnList.forEach((turn) => {
    const speaker = turn.querySelector(".transcript-speaker")?.textContent?.trim() ?? "";
    const ts = turn.querySelector(".transcript-timestamp")?.textContent?.trim() ?? "";
    children.push(
      new Paragraph({
        spacing: { before: 240, after: 60 },
        children: [
          new TextRun({ text: speaker, bold: true, color: "111827" }),
          new TextRun({ text: "    " }),
          new TextRun({ text: ts, color: "6B7280", size: 18 }),
        ],
      }),
    );
    const userBody = turn.querySelector(".transcript-user-body");
    if (userBody) {
      const text = (userBody.textContent ?? "").trimEnd();
      text.split("\n").forEach((line) => {
        children.push(
          new Paragraph({
            spacing: { before: 20, after: 20 },
            shading: { type: ShadingType.CLEAR, color: "auto", fill: "EFF6FF" },
            children: [new TextRun(line || " ")],
          }),
        );
      });
    } else {
      // Assistant body: prose div is the next element after head
      const body = Array.from(turn.children).find(
        (c) => !(c as HTMLElement).classList.contains("transcript-turn-head")
          && !(c as HTMLElement).classList.contains("transcript-citations"),
      ) as HTMLElement | undefined;
      if (body) {
        body.childNodes.forEach((c) => {
          if (c.nodeType === Node.ELEMENT_NODE) {
            children.push(...blockFromElement(c as HTMLElement));
          }
        });
      }
    }
    const cite = turn.querySelector(".transcript-citations");
    if (cite) {
      children.push(
        new Paragraph({
          spacing: { before: 80, after: 40 },
          children: [new TextRun({ text: cite.textContent ?? "", italics: true, color: "6B7280", size: 18 })],
        }),
      );
    }
  });

  const doc = new Document({
    numbering: NUMBERING_CONFIG,
    styles: {
      default: {
        document: {
          run: { font: "Calibri", size: 22 },
        },
      },
    },
    sections: [
      {
        properties: {
          page: {
            size: { width: 12240, height: 15840 },
            margin: { top: 1080, right: 1080, bottom: 1080, left: 1080 },
          },
        },
        headers: {
          default: new Header({
            children: [
              new Paragraph({
                alignment: AlignmentType.RIGHT,
                children: [
                  new TextRun({
                    text: thread.title || "Assistant transcript",
                    color: "9CA3AF",
                    size: 18,
                  }),
                ],
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
                  new TextRun({ text: "Page ", color: "9CA3AF", size: 18 }),
                  new TextRun({ children: [PageNumber.CURRENT], color: "9CA3AF", size: 18 }),
                  new TextRun({ text: " of ", color: "9CA3AF", size: 18 }),
                  new TextRun({ children: [PageNumber.TOTAL_PAGES], color: "9CA3AF", size: 18 }),
                ],
              }),
            ],
          }),
        },
        children,
      },
    ],
  });

  const blob = await Packer.toBlob(doc);
  const filename = `assistant-thread-${slugify(thread.title)}.docx`;
  saveAs(blob, filename);
  (window as any).__docxImages = [];
  cleanup();
}


function prettyPersona(p: string): string {
  const m: Record<string, string> = {
    capture_manager: "Capture Manager",
    proposal_writer: "Proposal Writer",
    compliance_reviewer: "Compliance Reviewer",
    pricing_analyst: "Pricing Analyst",
    executive: "Executive",
    plain_english: "Plain English",
  };
  return m[p] ?? p;
}

// Avoid TS "unused" warning on ImageRun import (kept for future image embedding).
void ImageRun;
