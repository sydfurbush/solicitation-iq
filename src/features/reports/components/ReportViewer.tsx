import { useState } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Download, FileType } from "lucide-react";
import { saveAs } from "file-saver";
import { generatePdf } from "../utils/pdfGenerator";
import { generateDocx } from "../utils/wordGenerator";
import type { ReportContent } from "../templates/types";
import { sectionBlocks, type Block } from "../templates/blocks";
import type { ReportRow } from "../hooks/useReports";
import { LensSnapshotBadge } from "@/features/clients/components/LensSnapshotBadge";
import { CATEGORY_HEX, type CategoryTone } from "../templates/theme";
import { softBreakWord } from "../utils/textBreaks";

function tone(t: CategoryTone | string | undefined) {
  const key = (t ?? "neutral") as CategoryTone;
  return CATEGORY_HEX[key] ?? CATEGORY_HEX.neutral;
}

function fmtDate(d: string) {
  try { return new Date(d).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" }); }
  catch { return d; }
}

function renderInline(text: string) {
  const parts: Array<{ text: string; bold?: boolean; italic?: boolean }> = [];
  let i = 0;
  const re = /\*\*(.+?)\*\*|\*(.+?)\*|`(.+?)`/g;
  let m;
  while ((m = re.exec(text)) !== null) {
    if (m.index > i) parts.push({ text: text.slice(i, m.index) });
    parts.push({ text: m[1] ?? m[2] ?? m[3] ?? "", bold: !!m[1], italic: !!m[2] });
    i = m.index + m[0].length;
  }
  if (i < text.length) parts.push({ text: text.slice(i) });
  return parts.map((p, idx) => (
    <span key={idx} className={p.bold ? "font-semibold" : p.italic ? "italic" : ""}>{p.text}</span>
  ));
}

function MarkdownLite({ source }: { source: string }) {
  const lines = (source ?? "").split(/\r?\n/);
  const out: React.ReactNode[] = [];
  let bullets: string[] = [];
  const flushBullets = () => {
    if (bullets.length) {
      out.push(
        <ul key={`u-${out.length}`} className="list-disc pl-6 space-y-1 my-2">
          {bullets.map((b, i) => <li key={i}>{renderInline(b)}</li>)}
        </ul>
      );
      bullets = [];
    }
  };
  lines.forEach((raw, idx) => {
    const line = raw.trim();
    if (!line) { flushBullets(); return; }
    if (/^[-*]\s+/.test(line)) { bullets.push(line.replace(/^[-*]\s+/, "")); return; }
    flushBullets();
    if (/^###\s+/.test(line)) out.push(<h4 key={idx} className="font-semibold text-base mt-3">{renderInline(line.replace(/^###\s+/, ""))}</h4>);
    else if (/^##\s+/.test(line)) out.push(<h3 key={idx} className="font-semibold text-lg mt-3">{renderInline(line.replace(/^##\s+/, ""))}</h3>);
    else if (/^#\s+/.test(line)) out.push(<h2 key={idx} className="font-bold text-xl mt-4">{renderInline(line.replace(/^#\s+/, ""))}</h2>);
    else out.push(<p key={idx} className="my-2 leading-relaxed">{renderInline(line)}</p>);
  });
  flushBullets();
  return <>{out}</>;
}

function BlocksRenderer({ blocks, fallbackBody }: { blocks: Block[]; fallbackBody?: string }) {
  if (!blocks?.length) return <MarkdownLite source={fallbackBody ?? ""} />;
  return (
    <div className="space-y-3">
      {blocks.map((b, i) => {
        switch (b.kind) {
          case "paragraph":
            return <p key={i} className="leading-relaxed">{renderInline(b.text)}</p>;
          case "bullets":
            return (
              <ul key={i} className="list-disc pl-6 space-y-1">
                {b.items.map((it, j) => <li key={j}>{renderInline(it)}</li>)}
              </ul>
            );
          case "kv":
            return (
              <table key={i} className="w-full border-collapse text-sm my-2">
                <tbody>
                  {b.rows.map(([k, v], j) => (
                    <tr key={j}>
                      <th className="bg-[#1E3A5F] text-white text-left px-3 py-2 font-semibold w-48 align-top">{k}</th>
                      <td className={`px-3 py-2 border border-[#E5E7EB] align-top ${j % 2 ? "bg-[#F5F7FA]" : "bg-white"}`}>{v}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            );
          case "category": {
            const headerCls = b.tone === "opportunity" ? "bg-[#2E7D32]" : b.tone === "risk" ? "bg-[#C62828]" : "bg-[#1E3A5F]";
            const tintCls = b.tone === "opportunity" ? "bg-[#E8F3EA] text-[#2E7D32]" : b.tone === "risk" ? "bg-[#FBEAEA] text-[#C62828]" : "bg-[#EAF2FA] text-[#1E3A5F]";
            return (
              <div key={i} className="border border-[#E5E7EB] my-2">
                <div className={`${headerCls} text-white px-3 py-2 font-bold text-sm uppercase`}>{b.title}</div>
                <table className="w-full border-collapse text-sm">
                  <tbody>
                    {b.rows.map(([t, d], j) => (
                      <tr key={j} className="border-t border-[#E5E7EB]">
                        <td className={`${tintCls} px-3 py-2 font-semibold w-56 align-top`}>{t}</td>
                        <td className="px-3 py-2 align-top">{d}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            );
          }
          case "recommendation":
            return (
              <div key={i} className="bg-[#FFF8E1] border-2 border-[#C9A227] p-6 text-center my-3">
                <p className="text-xs font-bold text-[#6B7280] tracking-wider">RECOMMENDATION</p>
                <p className="text-2xl font-bold text-[#1E3A5F] my-2 uppercase">{b.verdict}</p>
                <p className="italic text-sm text-[#374151]">{b.rationale}</p>
              </div>
            );
          case "steps":
            return (
              <table key={i} className="w-full border-collapse text-sm my-2 border border-[#E5E7EB]">
                <tbody>
                  {b.items.map((it, j) => (
                    <tr key={j} className="border-t border-[#E5E7EB]">
                      <td className="bg-[#1E3A5F] text-white text-center font-bold w-12 text-lg">{String(j + 1).padStart(2, "0")}</td>
                      <td className="bg-[#EAF2FA] text-[#1E3A5F] font-semibold px-3 py-3 w-56 align-top">{it.title}</td>
                      <td className="px-3 py-3 align-top">{it.detail}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            );
          default:
            return null;
        }
      })}
    </div>
  );
}

export function ReportViewer({ report, open, onOpenChange }: { report: ReportRow | null; open: boolean; onOpenChange: (v: boolean) => void }) {
  const [active, setActive] = useState(0);
  if (!report) return null;
  const content = report.content as unknown as ReportContent;
  const sections = content?.sections ?? [];

  const dl = async (fmt: "pdf" | "docx") => {
    if (fmt === "pdf") saveAs(generatePdf(content), `${report.title}.pdf`);
    else saveAs(await generateDocx(content), `${report.title}.docx`);
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-4xl overflow-y-auto">
        <SheetHeader>
          <SheetTitle>{report.title}</SheetTitle>
          <div className="flex items-center gap-2 pt-1">
            <LensSnapshotBadge snapshot={content?.lens ?? null} />
          </div>
        </SheetHeader>
        <div className="flex gap-2 mt-3">
          <Button size="sm" variant="outline" onClick={() => dl("pdf")}><Download className="h-3.5 w-3.5 mr-1" /> PDF</Button>
          <Button size="sm" variant="outline" onClick={() => dl("docx")}><FileType className="h-3.5 w-3.5 mr-1" /> Word</Button>
        </div>
        <div className="grid lg:grid-cols-[200px_1fr] gap-6 mt-6">
          <nav className="text-sm space-y-1 lg:sticky lg:top-0 self-start">
            <p className="text-xs font-semibold text-muted-foreground uppercase mb-2">Contents</p>
            {sections.map((s, i) => (
              <button
                key={i}
                onClick={() => { setActive(i); document.getElementById(`sec-${i}`)?.scrollIntoView({ behavior: "smooth" }); }}
                className={`block text-left w-full px-2 py-1 rounded hover:bg-muted ${active === i ? "bg-muted font-medium" : ""}`}
              >
                {s.heading}
              </button>
            ))}
          </nav>
          <article className="prose prose-sm max-w-none dark:prose-invert">
            {content.subtitle && <p className="text-muted-foreground italic mb-4">{content.subtitle}</p>}
            {sections.map((s, i) => (
              <section key={i} id={`sec-${i}`} className="mb-6">
                <h2 className="font-bold text-xl uppercase text-[#1E3A5F] border-b-2 border-[#C9A227] pb-1 mb-3">{s.heading}</h2>
                <BlocksRenderer blocks={sectionBlocks(s)} fallbackBody={s.body} />
              </section>
            ))}
            {content.citations?.length ? (
              <section>
                <h2 className="font-bold text-xl border-b pb-1 mb-3">Citations</h2>
                <ol className="list-decimal pl-6 text-xs space-y-1">
                  {content.citations.map((c, i) => (
                    <li key={i}>{c.document}{c.section ? ` §${c.section}` : ""}{c.page ? ` p.${c.page}` : ""}{c.quote ? ` — "${c.quote}"` : ""}</li>
                  ))}
                </ol>
              </section>
            ) : null}
          </article>
        </div>
      </SheetContent>
    </Sheet>
  );
}
