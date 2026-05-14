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
          case "coverHero":
            return (
              <div key={i} className="my-4 border border-[#E5E7EB] overflow-hidden">
                <div className="bg-[#1E3A5F] text-white flex items-center justify-between px-5 py-4">
                  <span className="font-bold text-lg uppercase tracking-wide">{b.firm}</span>
                  {b.confidential && <span className="text-[#C9A227] text-xs font-bold">CONFIDENTIAL</span>}
                </div>
                <div className="h-1 bg-[#C9A227]" />
                <div className="px-6 py-10 text-center">
                  <p className="text-xs font-bold tracking-widest text-[#C9A227]">CLIENT STRATEGIC QUESTIONNAIRE</p>
                  <h3 className="text-3xl font-bold text-[#1E3A5F] mt-3">{b.title}</h3>
                  <div className="w-32 h-0.5 bg-[#C9A227] mx-auto my-4" />
                  {b.solicitationNumber && <p className="text-sm text-[#374151]">{b.solicitationNumber}</p>}
                  {b.agency && <p className="text-sm text-[#374151]">{b.agency}</p>}
                  <p className="text-xs italic text-[#6B7280] mt-6">Generated {fmtDate(b.generatedAt)}</p>
                </div>
                <div className="h-2 bg-[#C9A227]" />
              </div>
            );
          case "statsStrip":
            return (
              <div key={i} className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2 my-3">
                {b.tiles.map((t, j) => (
                  <div key={j} className="overflow-hidden border border-[#E5E7EB]">
                    <div className="bg-[#EDF0F4] text-[#1E3A5F] text-2xl font-bold text-center py-3">{t.value}</div>
                    <div className="bg-[#1E3A5F] text-white text-[10px] font-bold uppercase text-center px-2 py-2 leading-tight">{t.label}</div>
                  </div>
                ))}
              </div>
            );
          case "categoryBand": {
            const c = tone(b.tone);
            return (
              <div key={i} className="flex items-center bg-[#E4E6EA] my-3 border-l-4" style={{ borderLeftColor: `#${c.solid}` }}>
                <div className="px-3 py-2 flex items-baseline gap-2">
                  <span className="font-bold text-sm uppercase text-[#1E3A5F]">{b.title}</span>
                  <span className="text-xs text-[#6B7280]">({b.count} question{b.count === 1 ? "" : "s"})</span>
                </div>
              </div>
            );
          }
          case "categoryLegend":
            return (
              <div key={i} className="grid sm:grid-cols-2 gap-3 my-3">
                {b.items.map((it, j) => {
                  const c = tone(it.tone);
                  return (
                    <div key={j} className="border-l-4 bg-[#F5F7FA] p-3" style={{ borderLeftColor: `#${c.solid}` }}>
                      <div className="flex items-center gap-2 mb-1">
                        <span className="inline-block w-2.5 h-2.5 rounded-full" style={{ background: `#${c.solid}` }} />
                        <span className="font-bold text-sm uppercase text-[#1E3A5F]">{it.label}</span>
                        <span className="text-xs text-[#6B7280]">({it.count} question{it.count === 1 ? "" : "s"})</span>
                      </div>
                      <p className="text-xs text-[#374151] leading-relaxed">{it.description}</p>
                    </div>
                  );
                })}
              </div>
            );
          case "indexTable":
            return (
              <div key={i} className="overflow-x-auto border border-[#E5E7EB] my-3">
                <table className="w-full border-collapse text-xs table-fixed">
                  <colgroup>
                    <col style={{ width: "5%" }} />
                    <col style={{ width: "18%" }} />
                    <col style={{ width: "32%" }} />
                    <col style={{ width: "45%" }} />
                  </colgroup>
                  <thead>
                    <tr className="bg-[#1E3A5F] text-white text-left">
                      <th className="px-2 py-2 font-bold">#</th>
                      <th className="px-2 py-2 font-bold">CATEGORY</th>
                      <th className="px-2 py-2 font-bold">SOURCE</th>
                      <th className="px-2 py-2 font-bold">TOPIC / SUMMARY</th>
                    </tr>
                  </thead>
                  <tbody>
                    {b.rows.map((r, j) => {
                      const c = tone(r.tone);
                      return (
                        <tr key={j} className={j % 2 ? "bg-[#F5F7FA]" : "bg-white"}>
                          <td className="px-2 py-2 align-top font-bold text-[#6B7280]">{r.index}</td>
                          <td className="px-2 py-2 align-top">
                            <span className="inline-block px-1.5 py-0.5 text-[10px] font-bold uppercase break-words" style={{ background: `#${c.tint}`, color: `#${c.solid}` }}>
                              {r.categoryLabel}
                            </span>
                          </td>
                          <td className="px-2 py-2 align-top text-[#374151] break-words" style={{ wordBreak: "break-word" }}>{softBreakWord(r.source, 12)}</td>
                          <td className="px-2 py-2 align-top text-[#374151] break-words" style={{ wordBreak: "break-word" }}>{softBreakWord(r.topic, 12)}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            );
          case "questionCard": {
            const c = tone(b.tone);
            return (
              <div key={i} className="flex border-l-4 border-[#C9A227] bg-[#F5F7FA] my-3">
                <div className="bg-white w-24 shrink-0 p-3 text-center border-r border-[#E5E7EB]">
                  <div className="font-bold text-xl text-[#1E3A5F]">Q{b.index}</div>
                  <div className="mt-2 inline-block px-1.5 py-0.5 text-[10px] font-bold uppercase break-words leading-tight" style={{ background: `#${c.tint}`, color: `#${c.solid}` }}>
                    {b.categoryLabel}
                  </div>
                </div>
                <div className="flex-1 p-3 space-y-2 min-w-0">
                  <p className="text-sm text-[#374151] leading-relaxed">{b.question}</p>
                  {b.rationale && <p className="text-xs italic text-[#6B7280]"><span className="font-semibold not-italic">Rationale:</span> {b.rationale}</p>}
                  {b.source && <p className="text-xs font-semibold text-[#C9A227]">Source: {b.source}</p>}
                  {b.agencyResponse && <p className="text-xs italic text-[#374151]"><span className="font-semibold not-italic">Agency response:</span> {b.agencyResponse}</p>}
                </div>
              </div>
            );
          }
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
