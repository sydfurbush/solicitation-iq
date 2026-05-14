import jsPDF from "jspdf";
import type { ReportContent } from "../templates/types";
import { sectionBlocks, type Block } from "../templates/blocks";
import { RGB, FONT_PDF, DEFAULT_FOOTER_TEXT, CATEGORY_RGB } from "../templates/theme";
import { hardBreakWord } from "./textBreaks";

const PAGE = { w: 612, h: 792 }; // US Letter pt
const MARGIN = { top: 36, right: 56, bottom: 56, left: 56 };
const HEADER_H = 18;
const FOOTER_H = 32;
const CONTENT_TOP = MARGIN.top + HEADER_H + 6;
const CONTENT_BOTTOM = PAGE.h - MARGIN.bottom - FOOTER_H;
const CONTENT_W = PAGE.w - MARGIN.left - MARGIN.right;

function fmt(d: string) {
  try { return new Date(d).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" }); }
  catch { return d; }
}

type Ctx = {
  doc: jsPDF;
  y: number;
  page: number;
  headerLeft: string;
  headerRight: string;
  headerExtra?: string;
  footerLeft: string;
  footerTitle?: string;
};

function setFill(doc: jsPDF, c: [number, number, number]) { doc.setFillColor(c[0], c[1], c[2]); }
function setText(doc: jsPDF, c: [number, number, number]) { doc.setTextColor(c[0], c[1], c[2]); }
function setDraw(doc: jsPDF, c: [number, number, number]) { doc.setDrawColor(c[0], c[1], c[2]); }

function drawHeader(ctx: Ctx) {
  const { doc, headerLeft, headerRight, headerExtra } = ctx;
  doc.setFont(FONT_PDF, "bold");
  doc.setFontSize(9);
  setText(doc, RGB.navy);
  doc.text(headerLeft.toUpperCase(), MARGIN.left, MARGIN.top);
  const leftW = doc.getTextWidth(headerLeft.toUpperCase());
  setText(doc, RGB.amber);
  doc.text(" |", MARGIN.left + leftW, MARGIN.top);
  setText(doc, RGB.navy);
  doc.text(headerRight.toUpperCase(), MARGIN.left + leftW + 14, MARGIN.top);
  if (headerExtra) {
    setText(doc, RGB.textMuted);
    doc.setFont(FONT_PDF, "bold");
    doc.text(headerExtra.toUpperCase(), PAGE.w - MARGIN.right, MARGIN.top, { align: "right" });
  }
  setDraw(doc, RGB.navy);
  doc.setLineWidth(0.6);
  doc.line(MARGIN.left, MARGIN.top + 6, PAGE.w - MARGIN.right, MARGIN.top + 6);
  setDraw(doc, RGB.amber);
  doc.setLineWidth(0.4);
  doc.line(MARGIN.left, MARGIN.top + 8, PAGE.w - MARGIN.right, MARGIN.top + 8);
}

function drawFooter(ctx: Ctx) {
  const { doc, footerLeft, footerTitle } = ctx;
  const y = PAGE.h - MARGIN.bottom;
  setDraw(doc, RGB.amber);
  doc.setLineWidth(0.4);
  doc.line(MARGIN.left, y - 14, PAGE.w - MARGIN.right, y - 14);
  doc.setFont(FONT_PDF, "normal");
  doc.setFontSize(8);
  setText(doc, RGB.textMuted);
  if (footerTitle) {
    doc.text(footerTitle, PAGE.w / 2, y - 4, { align: "center" });
  }
  doc.text(footerLeft, MARGIN.left, y - 4);
  doc.setFont(FONT_PDF, "italic");
  // Total page placeholder; stamped after layout.
  doc.text(`Page ${ctx.page}`, PAGE.w - MARGIN.right, y - 4, { align: "right" });
}

function newPage(ctx: Ctx) {
  ctx.doc.addPage();
  ctx.page += 1;
  drawHeader(ctx);
  drawFooter(ctx);
  ctx.y = CONTENT_TOP;
}

function ensureSpace(ctx: Ctx, h: number) {
  if (ctx.y + h > CONTENT_BOTTOM) newPage(ctx);
}

function wrap(doc: jsPDF, text: string, w: number, fontStyle: "normal" | "bold" | "italic" = "normal", size = 10): string[] {
  doc.setFont(FONT_PDF, fontStyle);
  doc.setFontSize(size);
  return doc.splitTextToSize(text || "", w);
}

/** Clip each rendered line to a max width by truncating with an ellipsis.
 *  Caller must have already set the desired font + size. */
function clipLines(doc: jsPDF, lines: string[], maxW: number): string[] {
  return lines.map((line) => {
    if (doc.getTextWidth(line) <= maxW) return line;
    let lo = 0, hi = line.length;
    while (lo < hi) {
      const mid = Math.ceil((lo + hi) / 2);
      if (doc.getTextWidth(line.slice(0, mid) + "…") <= maxW) lo = mid;
      else hi = mid - 1;
    }
    return line.slice(0, lo).replace(/\s+$/, "") + "…";
  });
}

function drawCoverBand(ctx: Ctx, content: ReportContent) {
  const { doc } = ctx;
  const x = MARGIN.left;
  const y = ctx.y;
  const w = CONTENT_W;
  const h = 110;
  setFill(doc, RGB.navy);
  doc.rect(x, y, w, h, "F");
  // amber accent rule on the left
  setFill(doc, RGB.amber);
  doc.rect(x, y, 4, h, "F");

  // eyebrow
  doc.setFont(FONT_PDF, "bold");
  doc.setFontSize(9);
  setText(doc, RGB.amber);
  doc.text("EXECUTIVE REPORT", x + 18, y + 24);

  // title
  doc.setFont(FONT_PDF, "bold");
  doc.setFontSize(22);
  setText(doc, RGB.white);
  const titleLines = wrap(doc, content.title, w - 36, "bold", 22).slice(0, 2);
  let ty = y + 48;
  for (const line of titleLines) { doc.text(line, x + 18, ty); ty += 26; }

  // meta
  doc.setFont(FONT_PDF, "normal");
  doc.setFontSize(10);
  setText(doc, RGB.white);
  const meta = [
    content.subtitle,
    `Generated ${fmt(content.generatedAt)}`,
  ].filter(Boolean).join("   •   ");
  doc.text(meta, x + 18, y + h - 16);

  ctx.y = y + h + 22;
}

function drawStatsStrip(ctx: Ctx, tiles: Array<{ label: string; value: number | string }>) {
  if (!tiles.length) return;
  const { doc } = ctx;
  const perRow = 5;
  const gap = 8;
  const tileW = (CONTENT_W - gap * (perRow - 1)) / perRow;
  const valueH = 30;
  const labelH = 22;
  const tileH = valueH + labelH;
  for (let i = 0; i < tiles.length; i += perRow) {
    const row = tiles.slice(i, i + perRow);
    ensureSpace(ctx, tileH + 8);
    row.forEach((t, j) => {
      const x = MARGIN.left + j * (tileW + gap);
      // value cell (light grey)
      setFill(doc, RGB.tileGrey);
      doc.rect(x, ctx.y, tileW, valueH, "F");
      doc.setFont(FONT_PDF, "bold");
      doc.setFontSize(16);
      setText(doc, RGB.navy);
      doc.text(String(t.value), x + tileW / 2, ctx.y + valueH - 9, { align: "center" });
      // label cell (navy)
      setFill(doc, RGB.navy);
      doc.rect(x, ctx.y + valueH, tileW, labelH, "F");
      doc.setFont(FONT_PDF, "bold");
      doc.setFontSize(8);
      setText(doc, RGB.white);
      const lbl = wrap(doc, t.label.toUpperCase(), tileW - 8, "bold", 8).slice(0, 2);
      let ly = ctx.y + valueH + (lbl.length === 1 ? 14 : 11);
      for (const line of lbl) { doc.text(line, x + tileW / 2, ly, { align: "center" }); ly += 9; }
    });
    ctx.y += tileH + 8;
  }
  ctx.y += 6;
}

function drawCategoryBand(ctx: Ctx, title: string, count: number, tone: keyof typeof CATEGORY_RGB) {
  const t = CATEGORY_RGB[tone];
  const h = 22;
  ensureSpace(ctx, h + 12);
  // grey band background
  setFill(ctx.doc, RGB.bandGrey);
  ctx.doc.rect(MARGIN.left, ctx.y, CONTENT_W, h, "F");
  // colored left bar
  setFill(ctx.doc, t.solid);
  ctx.doc.rect(MARGIN.left, ctx.y, 4, h, "F");
  ctx.doc.setFont(FONT_PDF, "bold");
  ctx.doc.setFontSize(10);
  setText(ctx.doc, RGB.navy);
  ctx.doc.text(title.toUpperCase(), MARGIN.left + 14, ctx.y + 14);
  ctx.doc.setFont(FONT_PDF, "normal");
  ctx.doc.setFontSize(9);
  setText(ctx.doc, RGB.textMuted);
  const countText = `(${count} question${count === 1 ? "" : "s"})`;
  const titleW = ctx.doc.getTextWidth(title.toUpperCase());
  ctx.doc.text(countText, MARGIN.left + 14 + titleW + 8, ctx.y + 14);
  ctx.y += h + 8;
}

function drawQuestionCard(
  ctx: Ctx,
  card: Extract<Block, { kind: "questionCard" }>,
) {
  const { doc } = ctx;
  const t = CATEGORY_RGB[card.tone] ?? CATEGORY_RGB.neutral;
  const labelW = 84;
  const accentW = 4;
  const bodyX = MARGIN.left + accentW + labelW;
  const bodyW = CONTENT_W - accentW - labelW;
  const innerPad = 10;

  // measure body
  const qLines = wrap(doc, card.question, bodyW - innerPad * 2, "normal", 10);
  const ratLines = card.rationale ? wrap(doc, `Rationale: ${card.rationale}`, bodyW - innerPad * 2, "italic", 9) : [];
  const srcLines = card.source ? wrap(doc, `Source: ${card.source}`, bodyW - innerPad * 2, "bold", 9) : [];
  const respLines = card.agencyResponse ? wrap(doc, `Agency response: ${card.agencyResponse}`, bodyW - innerPad * 2, "italic", 9) : [];
  const bodyTextH =
    qLines.length * 13 +
    (ratLines.length ? 6 + ratLines.length * 12 : 0) +
    (srcLines.length ? 6 + srcLines.length * 12 : 0) +
    (respLines.length ? 6 + respLines.length * 12 : 0);
  const cardH = Math.max(64, bodyTextH + innerPad * 2);

  ensureSpace(ctx, cardH + 6);

  // Card background
  setFill(doc, RGB.rowAlt);
  doc.rect(MARGIN.left, ctx.y, CONTENT_W, cardH, "F");
  // Amber accent left bar
  setFill(doc, RGB.amber);
  doc.rect(MARGIN.left, ctx.y, accentW, cardH, "F");
  // Q label cell (white)
  setFill(doc, RGB.white);
  doc.rect(MARGIN.left + accentW, ctx.y, labelW, cardH, "F");

  // Q number
  doc.setFont(FONT_PDF, "bold");
  doc.setFontSize(13);
  setText(doc, RGB.navy);
  doc.text(`Q${card.index}`, MARGIN.left + accentW + 10, ctx.y + 22);

  // Category badge (under Q#)
  const badgeText = card.categoryLabel.toUpperCase();
  doc.setFont(FONT_PDF, "bold");
  doc.setFontSize(7);
  const badgeLines = doc.splitTextToSize(badgeText, labelW - 12);
  const badgeH = badgeLines.length * 9 + 6;
  setFill(doc, t.tint);
  doc.rect(MARGIN.left + accentW + 6, ctx.y + 30, labelW - 12, badgeH, "F");
  setText(doc, t.solid);
  let by = ctx.y + 30 + 8;
  for (const line of badgeLines) { doc.text(line, MARGIN.left + accentW + 6 + (labelW - 12) / 2, by, { align: "center" }); by += 9; }

  // Body text
  let y = ctx.y + innerPad + 4;
  doc.setFont(FONT_PDF, "normal");
  doc.setFontSize(10);
  setText(doc, RGB.text);
  for (const line of qLines) { doc.text(line, bodyX + innerPad, y); y += 13; }
  if (ratLines.length) {
    y += 6;
    doc.setFont(FONT_PDF, "italic");
    doc.setFontSize(9);
    setText(doc, RGB.textMuted);
    for (const line of ratLines) { doc.text(line, bodyX + innerPad, y); y += 12; }
  }
  if (srcLines.length) {
    y += 6;
    doc.setFont(FONT_PDF, "bold");
    doc.setFontSize(9);
    setText(doc, RGB.amber);
    for (const line of srcLines) { doc.text(line, bodyX + innerPad, y); y += 12; }
  }
  if (respLines.length) {
    y += 6;
    doc.setFont(FONT_PDF, "italic");
    doc.setFontSize(9);
    setText(doc, RGB.text);
    for (const line of respLines) { doc.text(line, bodyX + innerPad, y); y += 12; }
  }

  ctx.y += cardH + 6;
}

function drawSectionHeading(ctx: Ctx, text: string) {
  ensureSpace(ctx, 36);
  const { doc } = ctx;
  doc.setFont(FONT_PDF, "bold");
  doc.setFontSize(13);
  setText(doc, RGB.navy);
  doc.text(text.toUpperCase(), MARGIN.left, ctx.y);
  // amber underline
  setDraw(doc, RGB.amber);
  doc.setLineWidth(0.6);
  doc.line(MARGIN.left, ctx.y + 6, PAGE.w - MARGIN.right, ctx.y + 6);
  ctx.y += 20;
}

function drawParagraph(ctx: Ctx, text: string) {
  const lines = wrap(ctx.doc, text, CONTENT_W, "normal", 10);
  setText(ctx.doc, RGB.text);
  for (const line of lines) {
    ensureSpace(ctx, 14);
    ctx.doc.text(line, MARGIN.left, ctx.y);
    ctx.y += 14;
  }
  ctx.y += 4;
}

function drawBullets(ctx: Ctx, items: string[]) {
  setText(ctx.doc, RGB.text);
  ctx.doc.setFont(FONT_PDF, "normal");
  ctx.doc.setFontSize(10);
  for (const item of items) {
    const lines = wrap(ctx.doc, item, CONTENT_W - 16, "normal", 10);
    ensureSpace(ctx, 14 * lines.length + 2);
    setFill(ctx.doc, RGB.amber);
    ctx.doc.circle(MARGIN.left + 4, ctx.y - 3, 1.6, "F");
    let ly = ctx.y;
    for (const line of lines) {
      ctx.doc.text(line, MARGIN.left + 14, ly);
      ly += 13;
    }
    ctx.y = ly + 1;
  }
  ctx.y += 4;
}

function drawKV(ctx: Ctx, rows: Array<[string, string]>) {
  const labelW = 150;
  const valueW = CONTENT_W - labelW;
  for (let i = 0; i < rows.length; i++) {
    const [k, v] = rows[i];
    const valueLines = wrap(ctx.doc, v, valueW - 16, "normal", 10);
    const rowH = Math.max(22, valueLines.length * 13 + 10);
    ensureSpace(ctx, rowH);
    // label cell — navy fill
    setFill(ctx.doc, RGB.navy);
    ctx.doc.rect(MARGIN.left, ctx.y, labelW, rowH, "F");
    // value cell — alt row tint
    setFill(ctx.doc, i % 2 === 0 ? RGB.white : RGB.rowAlt);
    ctx.doc.rect(MARGIN.left + labelW, ctx.y, valueW, rowH, "F");
    setDraw(ctx.doc, RGB.border);
    ctx.doc.setLineWidth(0.3);
    ctx.doc.rect(MARGIN.left + labelW, ctx.y, valueW, rowH, "S");
    // label text
    ctx.doc.setFont(FONT_PDF, "bold");
    ctx.doc.setFontSize(10);
    setText(ctx.doc, RGB.white);
    ctx.doc.text(k, MARGIN.left + 10, ctx.y + 14);
    // value text
    ctx.doc.setFont(FONT_PDF, "normal");
    setText(ctx.doc, RGB.text);
    let vy = ctx.y + 14;
    for (const line of valueLines) {
      ctx.doc.text(line, MARGIN.left + labelW + 10, vy);
      vy += 13;
    }
    ctx.y += rowH;
  }
  ctx.y += 8;
}

function drawCategoryTable(ctx: Ctx, b: Extract<Block, { kind: "category" }>) {
  const tone = b.tone;
  const headerColor = tone === "opportunity" ? RGB.oppGreen : tone === "risk" ? RGB.riskRed : RGB.navy;
  const tintColor = tone === "opportunity" ? RGB.oppTint : tone === "risk" ? RGB.riskTint : RGB.lightBlue;
  const headerH = 22;

  ensureSpace(ctx, headerH + 24);
  // Header
  setFill(ctx.doc, headerColor);
  ctx.doc.rect(MARGIN.left, ctx.y, CONTENT_W, headerH, "F");
  ctx.doc.setFont(FONT_PDF, "bold");
  ctx.doc.setFontSize(10);
  setText(ctx.doc, RGB.white);
  ctx.doc.text(b.title.toUpperCase(), MARGIN.left + 10, ctx.y + 14);
  ctx.y += headerH;

  // Rows
  const titleW = 180;
  const descW = CONTENT_W - titleW;
  for (const [title, desc] of b.rows) {
    const descLines = wrap(ctx.doc, desc, descW - 16, "normal", 10);
    const titleLines = wrap(ctx.doc, title, titleW - 16, "bold", 10);
    const rowH = Math.max(28, Math.max(descLines.length, titleLines.length) * 13 + 12);
    ensureSpace(ctx, rowH);
    // tint left cell
    setFill(ctx.doc, tintColor);
    ctx.doc.rect(MARGIN.left, ctx.y, titleW, rowH, "F");
    // white right cell
    setFill(ctx.doc, RGB.white);
    ctx.doc.rect(MARGIN.left + titleW, ctx.y, descW, rowH, "F");
    setDraw(ctx.doc, RGB.border);
    ctx.doc.setLineWidth(0.3);
    ctx.doc.rect(MARGIN.left, ctx.y, CONTENT_W, rowH, "S");
    ctx.doc.line(MARGIN.left + titleW, ctx.y, MARGIN.left + titleW, ctx.y + rowH);
    // title text
    ctx.doc.setFont(FONT_PDF, "bold");
    setText(ctx.doc, headerColor);
    let ty = ctx.y + 14;
    for (const line of titleLines) { ctx.doc.text(line, MARGIN.left + 10, ty); ty += 13; }
    // desc text
    ctx.doc.setFont(FONT_PDF, "normal");
    setText(ctx.doc, RGB.text);
    let dy = ctx.y + 14;
    for (const line of descLines) { ctx.doc.text(line, MARGIN.left + titleW + 10, dy); dy += 13; }
    ctx.y += rowH;
  }
  ctx.y += 8;
}

function drawRecommendation(ctx: Ctx, verdict: string, rationale: string) {
  const padX = 18;
  const padY = 16;
  const rationaleLines = wrap(ctx.doc, rationale, CONTENT_W - padX * 2, "italic", 10);
  const boxH = 24 + 30 + rationaleLines.length * 13 + padY * 2;
  ensureSpace(ctx, boxH);
  setFill(ctx.doc, RGB.cream);
  ctx.doc.rect(MARGIN.left, ctx.y, CONTENT_W, boxH, "F");
  setDraw(ctx.doc, RGB.amber);
  ctx.doc.setLineWidth(1.2);
  ctx.doc.rect(MARGIN.left, ctx.y, CONTENT_W, boxH, "S");
  // label
  ctx.doc.setFont(FONT_PDF, "bold");
  ctx.doc.setFontSize(9);
  setText(ctx.doc, RGB.textMuted);
  ctx.doc.text("RECOMMENDATION", MARGIN.left + CONTENT_W / 2, ctx.y + padY + 4, { align: "center" });
  // verdict
  ctx.doc.setFont(FONT_PDF, "bold");
  ctx.doc.setFontSize(20);
  setText(ctx.doc, RGB.navy);
  ctx.doc.text(verdict.toUpperCase(), MARGIN.left + CONTENT_W / 2, ctx.y + padY + 28, { align: "center" });
  // rationale
  ctx.doc.setFont(FONT_PDF, "italic");
  ctx.doc.setFontSize(10);
  setText(ctx.doc, RGB.text);
  let ry = ctx.y + padY + 50;
  for (const line of rationaleLines) {
    ctx.doc.text(line, MARGIN.left + CONTENT_W / 2, ry, { align: "center" });
    ry += 13;
  }
  ctx.y += boxH + 8;
}

function drawSteps(ctx: Ctx, items: Array<{ title: string; detail: string }>) {
  const numW = 40;
  const titleW = 160;
  const detailW = CONTENT_W - numW - titleW;
  for (let i = 0; i < items.length; i++) {
    const it = items[i];
    const detailLines = wrap(ctx.doc, it.detail, detailW - 16, "normal", 10);
    const titleLines = wrap(ctx.doc, it.title, titleW - 16, "bold", 10);
    const rowH = Math.max(36, Math.max(detailLines.length, titleLines.length) * 13 + 14);
    ensureSpace(ctx, rowH);
    // navy number cell
    setFill(ctx.doc, RGB.navy);
    ctx.doc.rect(MARGIN.left, ctx.y, numW, rowH, "F");
    // light-blue title cell
    setFill(ctx.doc, RGB.lightBlue);
    ctx.doc.rect(MARGIN.left + numW, ctx.y, titleW, rowH, "F");
    // white detail cell
    setFill(ctx.doc, RGB.white);
    ctx.doc.rect(MARGIN.left + numW + titleW, ctx.y, detailW, rowH, "F");
    setDraw(ctx.doc, RGB.border);
    ctx.doc.setLineWidth(0.3);
    ctx.doc.rect(MARGIN.left, ctx.y, CONTENT_W, rowH, "S");
    ctx.doc.line(MARGIN.left + numW, ctx.y, MARGIN.left + numW, ctx.y + rowH);
    ctx.doc.line(MARGIN.left + numW + titleW, ctx.y, MARGIN.left + numW + titleW, ctx.y + rowH);
    // number
    ctx.doc.setFont(FONT_PDF, "bold");
    ctx.doc.setFontSize(14);
    setText(ctx.doc, RGB.white);
    ctx.doc.text(String(i + 1).padStart(2, "0"), MARGIN.left + numW / 2, ctx.y + rowH / 2 + 4, { align: "center" });
    // title
    ctx.doc.setFont(FONT_PDF, "bold");
    ctx.doc.setFontSize(10);
    setText(ctx.doc, RGB.navy);
    let ty = ctx.y + 16;
    for (const line of titleLines) { ctx.doc.text(line, MARGIN.left + numW + 10, ty); ty += 13; }
    // detail
    ctx.doc.setFont(FONT_PDF, "normal");
    setText(ctx.doc, RGB.text);
    let dy = ctx.y + 16;
    for (const line of detailLines) { ctx.doc.text(line, MARGIN.left + numW + titleW + 10, dy); dy += 13; }
    ctx.y += rowH;
  }
  ctx.y += 8;
}

function drawCitations(ctx: Ctx, cites: NonNullable<ReportContent["citations"]>) {
  drawSectionHeading(ctx, "Source Citations");
  ctx.doc.setFont(FONT_PDF, "normal");
  ctx.doc.setFontSize(9);
  setText(ctx.doc, RGB.text);
  cites.forEach((c, i) => {
    const id = c.id || `C${i + 1}`;
    const text = `[${id}] ${c.document}${c.section ? ` §${c.section}` : ""}${c.page ? ` p.${c.page}` : ""}`;
    const lines = wrap(ctx.doc, text, CONTENT_W, "normal", 9);
    for (const line of lines) {
      ensureSpace(ctx, 12);
      ctx.doc.text(line, MARGIN.left, ctx.y);
      ctx.y += 12;
    }
  });
}

function drawCoverHero(ctx: Ctx, hero: Extract<Block, { kind: "coverHero" }>) {
  const { doc } = ctx;
  // start on a fresh page if not at the top
  if (ctx.y > CONTENT_TOP + 4) newPage(ctx);

  // Top firm band
  const bandH = 70;
  setFill(doc, RGB.navy);
  doc.rect(0, 0, PAGE.w, bandH, "F");
  setFill(doc, RGB.amber);
  doc.rect(0, bandH, PAGE.w, 4, "F");

  doc.setFont(FONT_PDF, "bold");
  doc.setFontSize(22);
  setText(doc, RGB.white);
  doc.text(hero.firm.toUpperCase(), MARGIN.left, 44);

  if (hero.confidential) {
    doc.setFont(FONT_PDF, "bold");
    doc.setFontSize(9);
    setText(doc, RGB.amber);
    doc.text("CONFIDENTIAL", PAGE.w - MARGIN.right, 44, { align: "right" });
  }

  // Title block — centered roughly mid-page
  const cy = PAGE.h / 2 - 60;
  doc.setFont(FONT_PDF, "bold");
  doc.setFontSize(11);
  setText(doc, RGB.amber);
  doc.text("CLIENT STRATEGIC QUESTIONNAIRE", PAGE.w / 2, cy, { align: "center" });

  doc.setFont(FONT_PDF, "bold");
  doc.setFontSize(28);
  setText(doc, RGB.navy);
  const titleLines = wrap(doc, hero.title, CONTENT_W - 40, "bold", 28).slice(0, 3);
  let ty = cy + 36;
  for (const line of titleLines) { doc.text(line, PAGE.w / 2, ty, { align: "center" }); ty += 32; }

  // amber rule
  setDraw(doc, RGB.amber);
  doc.setLineWidth(1.2);
  doc.line(PAGE.w / 2 - 80, ty + 6, PAGE.w / 2 + 80, ty + 6);

  // Sol# + Agency
  ty += 36;
  doc.setFont(FONT_PDF, "normal");
  doc.setFontSize(12);
  setText(doc, RGB.text);
  if (hero.solicitationNumber) { doc.text(hero.solicitationNumber, PAGE.w / 2, ty, { align: "center" }); ty += 18; }
  if (hero.agency) { doc.text(hero.agency, PAGE.w / 2, ty, { align: "center" }); ty += 18; }

  // Generated date footer band
  const footY = PAGE.h - 80;
  doc.setFont(FONT_PDF, "italic");
  doc.setFontSize(10);
  setText(doc, RGB.textMuted);
  doc.text(`Generated ${fmt(hero.generatedAt)}`, PAGE.w / 2, footY, { align: "center" });

  // bottom amber accent
  setFill(doc, RGB.amber);
  doc.rect(0, PAGE.h - 12, PAGE.w, 12, "F");

  newPage(ctx);
}

function drawCategoryLegend(ctx: Ctx, items: Array<{ tone: keyof typeof CATEGORY_RGB; label: string; count: number; description: string }>) {
  const { doc } = ctx;
  const cols = 2;
  const gap = 10;
  const cellW = (CONTENT_W - gap) / cols;
  const padX = 10;
  const padY = 10;

  for (let i = 0; i < items.length; i += cols) {
    const row = items.slice(i, i + cols);
    // measure each cell first
    const heights = row.map((it) => {
      const descLines = wrap(doc, it.description, cellW - padX * 2, "normal", 9);
      return Math.max(50, 22 + descLines.length * 11 + padY * 2);
    });
    const rowH = Math.max(...heights);
    ensureSpace(ctx, rowH + 8);
    row.forEach((it, j) => {
      const t = CATEGORY_RGB[it.tone] ?? CATEGORY_RGB.neutral;
      const x = MARGIN.left + j * (cellW + gap);
      // cell background
      setFill(doc, RGB.rowAlt);
      doc.rect(x, ctx.y, cellW, rowH, "F");
      // colored left bar
      setFill(doc, t.solid);
      doc.rect(x, ctx.y, 4, rowH, "F");
      // dot + label + count
      setFill(doc, t.solid);
      doc.circle(x + padX + 14, ctx.y + padY + 6, 4, "F");
      doc.setFont(FONT_PDF, "bold");
      doc.setFontSize(10);
      setText(doc, RGB.navy);
      doc.text(it.label.toUpperCase(), x + padX + 24, ctx.y + padY + 9);
      const labelW = doc.getTextWidth(it.label.toUpperCase());
      doc.setFont(FONT_PDF, "normal");
      doc.setFontSize(9);
      setText(doc, RGB.textMuted);
      doc.text(`(${it.count} question${it.count === 1 ? "" : "s"})`, x + padX + 24 + labelW + 6, ctx.y + padY + 9);
      // description
      const descLines = wrap(doc, it.description, cellW - padX * 2, "normal", 9);
      setText(doc, RGB.text);
      let dy = ctx.y + padY + 24;
      for (const line of descLines) { doc.text(line, x + padX, dy); dy += 11; }
    });
    ctx.y += rowH + 8;
  }
}

function drawIndexTable(ctx: Ctx, rows: Array<{ index: number; tone: keyof typeof CATEGORY_RGB; categoryLabel: string; source: string; topic: string }>) {
  const { doc } = ctx;
  const numW = 28;
  const catW = 95;
  const srcW = 150;
  const topicW = CONTENT_W - numW - catW - srcW;
  const padX = 6;
  const padY = 5;
  const headerH = 18;

  const drawHeader = () => {
    ensureSpace(ctx, headerH + 8);
    setFill(doc, RGB.navy);
    doc.rect(MARGIN.left, ctx.y, CONTENT_W, headerH, "F");
    doc.setFont(FONT_PDF, "bold");
    doc.setFontSize(8);
    setText(doc, RGB.white);
    doc.text("#", MARGIN.left + padX, ctx.y + 12);
    doc.text("CATEGORY", MARGIN.left + numW + padX, ctx.y + 12);
    doc.text("SOURCE", MARGIN.left + numW + catW + padX, ctx.y + 12);
    doc.text("TOPIC / SUMMARY", MARGIN.left + numW + catW + srcW + padX, ctx.y + 12);
    ctx.y += headerH;
  };

  drawHeader();

  rows.forEach((r, i) => {
    const t = CATEGORY_RGB[r.tone] ?? CATEGORY_RGB.neutral;
    doc.setFont(FONT_PDF, "normal"); doc.setFontSize(8);
    const topicLinesRaw = wrap(doc, hardBreakWord(r.topic), topicW - padX * 2, "normal", 8);
    const topicLines = clipLines(doc, topicLinesRaw, topicW - padX * 2);
    const srcLinesRaw = wrap(doc, hardBreakWord(r.source), srcW - padX * 2, "normal", 8);
    const srcLines = clipLines(doc, srcLinesRaw, srcW - padX * 2);
    doc.setFont(FONT_PDF, "bold"); doc.setFontSize(7);
    const catLinesRaw = wrap(doc, r.categoryLabel.toUpperCase(), catW - padX * 2, "bold", 7);
    const catLines = clipLines(doc, catLinesRaw, catW - padX * 2 - 10);
    const rowH = Math.max(20, Math.max(topicLines.length, srcLines.length, catLines.length) * 10 + padY * 2);
    if (ctx.y + rowH > CONTENT_BOTTOM) {
      newPage(ctx);
      drawHeader();
    }
    // alt row
    setFill(doc, i % 2 === 0 ? RGB.white : RGB.rowAlt);
    doc.rect(MARGIN.left, ctx.y, CONTENT_W, rowH, "F");
    // row separator
    setDraw(doc, RGB.border);
    doc.setLineWidth(0.2);
    doc.line(MARGIN.left, ctx.y + rowH, MARGIN.left + CONTENT_W, ctx.y + rowH);
    // # column
    doc.setFont(FONT_PDF, "bold");
    doc.setFontSize(9);
    setText(doc, RGB.textMuted);
    doc.text(String(r.index), MARGIN.left + padX, ctx.y + padY + 10);
    // Category pill
    const pillX = MARGIN.left + numW + padX;
    const pillY = ctx.y + padY + 1;
    const pillH = catLines.length * 9 + 4;
    const pillW = Math.min(catW - padX * 2, doc.getTextWidth(r.categoryLabel.toUpperCase()) + 10);
    setFill(doc, t.tint);
    doc.rect(pillX, pillY, pillW, pillH, "F");
    setText(doc, t.solid);
    doc.setFontSize(7);
    let cy = pillY + 8;
    for (const line of catLines) { doc.text(line, pillX + 5, cy); cy += 9; }
    // Source
    doc.setFont(FONT_PDF, "normal");
    doc.setFontSize(8);
    setText(doc, RGB.text);
    let sy = ctx.y + padY + 9;
    for (const line of srcLines) { doc.text(line, MARGIN.left + numW + catW + padX, sy); sy += 10; }
    // Topic
    let ty = ctx.y + padY + 9;
    for (const line of topicLines) { doc.text(line, MARGIN.left + numW + catW + srcW + padX, ty); ty += 10; }
    ctx.y += rowH;
  });
  ctx.y += 8;
}

function drawBlock(ctx: Ctx, b: Block) {
  switch (b.kind) {
    case "paragraph": return drawParagraph(ctx, b.text);
    case "bullets": return drawBullets(ctx, b.items);
    case "kv": return drawKV(ctx, b.rows);
    case "category": return drawCategoryTable(ctx, b);
    case "recommendation": return drawRecommendation(ctx, b.verdict, b.rationale);
    case "steps": return drawSteps(ctx, b.items);
    case "statsStrip": return drawStatsStrip(ctx, b.tiles);
    case "categoryBand": return drawCategoryBand(ctx, b.title, b.count, b.tone);
    case "questionCard": return drawQuestionCard(ctx, b);
    case "coverHero": return drawCoverHero(ctx, b);
    case "categoryLegend": return drawCategoryLegend(ctx, b.items);
    case "indexTable": return drawIndexTable(ctx, b.rows);
  }
}

function stampPageTotals(ctx: Ctx) {
  const total = ctx.doc.getNumberOfPages();
  const y = PAGE.h - MARGIN.bottom;
  for (let i = 1; i <= total; i++) {
    ctx.doc.setPage(i);
    // overpaint right side of footer to clear "Page N"
    setFill(ctx.doc, RGB.white);
    ctx.doc.rect(PAGE.w - MARGIN.right - 90, y - 12, 90, 12, "F");
    ctx.doc.setFont(FONT_PDF, "italic");
    ctx.doc.setFontSize(8);
    setText(ctx.doc, RGB.textMuted);
    ctx.doc.text(`Page ${i} of ${total}`, PAGE.w - MARGIN.right, y - 4, { align: "right" });
  }
}

export function generatePdf(report: ReportContent): Blob {
  const doc = new jsPDF({ unit: "pt", format: "letter" });
  const headerLeft = report.branding?.headerText
    || (typeof report.meta?.client === "string" ? report.meta.client : null)
    || report.title;
  const headerRight = (report.subtitle || report.meta?.solicitation_number || "") as string;
  const footerLeft = report.branding?.footerText || DEFAULT_FOOTER_TEXT;
  const headerExtra = "CONFIDENTIAL";
  const footerTitle = report.title;

  const ctx: Ctx = { doc, y: CONTENT_TOP, page: 1, headerLeft, headerRight, headerExtra, footerLeft, footerTitle };

  // Skip the default cover band when the report supplies its own coverHero block.
  const firstBlock = report.sections?.[0]?.blocks?.[0];
  const hasOwnCover = firstBlock?.kind === "coverHero";
  if (!hasOwnCover) {
    drawHeader(ctx);
    drawFooter(ctx);
    drawCoverBand(ctx, report);
  }

  for (const section of report.sections ?? []) {
    const blocks = sectionBlocks(section);
    const skipHeading = blocks[0]?.kind === "coverHero";
    if (!skipHeading) drawSectionHeading(ctx, section.heading);
    for (const b of blocks) drawBlock(ctx, b);
    ctx.y += 6;
  }

  if (report.citations?.length) {
    drawCitations(ctx, report.citations);
  }

  stampPageTotals(ctx);

  return doc.output("blob");
}
