// Structured content blocks rendered by both PDF and Word generators.

import type { CategoryTone } from "./theme";

export type Block =
  | { kind: "paragraph"; text: string }
  | { kind: "bullets"; items: string[] }
  | { kind: "kv"; rows: Array<[string, string]> }
  | {
      kind: "category";
      tone: "opportunity" | "risk" | "neutral";
      title: string;
      rows: Array<[string, string]>;
    }
  | { kind: "recommendation"; verdict: string; rationale: string }
  | { kind: "steps"; items: Array<{ title: string; detail: string }> }
  | { kind: "statsStrip"; tiles: Array<{ label: string; value: number | string }> }
  | { kind: "categoryBand"; title: string; count: number; tone: CategoryTone }
  | {
      kind: "questionCard";
      index: number;
      tone: CategoryTone;
      categoryLabel: string;
      question: string;
      rationale?: string;
      source?: string;
      agencyResponse?: string;
    };

function stripMd(line: string): string {
  return line
    .replace(/\*\*(.+?)\*\*/g, "$1")
    .replace(/\*(.+?)\*/g, "$1")
    .replace(/`(.+?)`/g, "$1")
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1");
}

/**
 * Convert legacy markdown body → block list.
 * Used when the AI returns `body` only and no `blocks`.
 */
export function bodyToBlocks(body: string | undefined | null): Block[] {
  if (!body) return [];
  const lines = body.split(/\r?\n/);
  const out: Block[] = [];
  let para: string[] = [];
  let bullets: string[] = [];

  const flushPara = () => {
    if (para.length) {
      out.push({ kind: "paragraph", text: stripMd(para.join(" ")).trim() });
      para = [];
    }
  };
  const flushBullets = () => {
    if (bullets.length) {
      out.push({ kind: "bullets", items: bullets.map((b) => stripMd(b)) });
      bullets = [];
    }
  };

  for (const raw of lines) {
    const line = raw.trim();
    if (!line) {
      flushPara();
      flushBullets();
      continue;
    }
    if (/^[-*]\s+/.test(line)) {
      flushPara();
      bullets.push(line.replace(/^[-*]\s+/, ""));
      continue;
    }
    flushBullets();
    if (/^#{1,6}\s+/.test(line)) {
      flushPara();
      out.push({ kind: "paragraph", text: stripMd(line.replace(/^#+\s+/, "")) });
      continue;
    }
    para.push(line);
  }
  flushPara();
  flushBullets();
  return out;
}

/** Get blocks for a section, falling back to markdown body. */
export function sectionBlocks(section: { body?: string; blocks?: Block[] }): Block[] {
  if (section.blocks?.length) return section.blocks;
  return bodyToBlocks(section.body);
}
