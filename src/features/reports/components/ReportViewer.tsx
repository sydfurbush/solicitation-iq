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
