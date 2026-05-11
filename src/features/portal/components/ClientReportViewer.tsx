import { Download, FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { format } from "date-fns";
import { sectionBlocks, type Block } from "@/features/reports/templates/blocks";

interface Props {
  report: any;
  onDownload?: (report: any, fmt: "pdf" | "docx") => void;
}

function renderBlock(b: Block, key: number) {
  switch (b.kind) {
    case "paragraph":
      return <p key={key} className="text-sm leading-relaxed my-2">{b.text}</p>;
    case "bullets":
      return (
        <ul key={key} className="list-disc pl-5 space-y-1 text-sm my-2">
          {b.items.map((it, i) => <li key={i}>{it}</li>)}
        </ul>
      );
    case "kv":
      return (
        <table key={key} className="w-full border-collapse text-sm my-2">
          <tbody>
            {b.rows.map(([k, v], i) => (
              <tr key={i}>
                <th className="bg-[#1E3A5F] text-white text-left px-3 py-2 font-semibold w-44 align-top">{k}</th>
                <td className={`px-3 py-2 border border-[#E5E7EB] align-top ${i % 2 ? "bg-[#F5F7FA]" : "bg-white"}`}>{v}</td>
              </tr>
            ))}
          </tbody>
        </table>
      );
    case "category": {
      const headerCls = b.tone === "opportunity" ? "bg-[#2E7D32]" : b.tone === "risk" ? "bg-[#C62828]" : "bg-[#1E3A5F]";
      const tintCls = b.tone === "opportunity" ? "bg-[#E8F3EA] text-[#2E7D32]" : b.tone === "risk" ? "bg-[#FBEAEA] text-[#C62828]" : "bg-[#EAF2FA] text-[#1E3A5F]";
      return (
        <div key={key} className="border border-[#E5E7EB] my-2">
          <div className={`${headerCls} text-white px-3 py-2 font-bold text-sm uppercase`}>{b.title}</div>
          <table className="w-full border-collapse text-sm">
            <tbody>
              {b.rows.map(([t, d], i) => (
                <tr key={i} className="border-t border-[#E5E7EB]">
                  <td className={`${tintCls} px-3 py-2 font-semibold w-52 align-top`}>{t}</td>
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
        <div key={key} className="bg-[#FFF8E1] border-2 border-[#C9A227] p-6 text-center my-3">
          <p className="text-xs font-bold text-[#6B7280] tracking-wider">RECOMMENDATION</p>
          <p className="text-2xl font-bold text-[#1E3A5F] my-2 uppercase">{b.verdict}</p>
          <p className="italic text-sm text-[#374151]">{b.rationale}</p>
        </div>
      );
    case "steps":
      return (
        <table key={key} className="w-full border-collapse text-sm my-2 border border-[#E5E7EB]">
          <tbody>
            {b.items.map((it, i) => (
              <tr key={i} className="border-t border-[#E5E7EB]">
                <td className="bg-[#1E3A5F] text-white text-center font-bold w-12 text-lg">{String(i + 1).padStart(2, "0")}</td>
                <td className="bg-[#EAF2FA] text-[#1E3A5F] font-semibold px-3 py-3 w-52 align-top">{it.title}</td>
                <td className="px-3 py-3 align-top">{it.detail}</td>
              </tr>
            ))}
          </tbody>
        </table>
      );
    default:
      return null;
  }
}

export function ClientReportViewer({ report, onDownload }: Props) {
  const sections = (report?.content?.sections ?? []) as Array<{ heading: string; body?: string; blocks?: Block[] }>;

  return (
    <Card className="h-full flex flex-col">
      <CardHeader className="border-b">
        <div className="flex items-start justify-between gap-3">
          <div>
            <CardTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" /> {report.title}
            </CardTitle>
            <div className="flex gap-2 mt-2 text-xs text-muted-foreground">
              <Badge variant="outline">v{report.version}</Badge>
              <span>{format(new Date(report.generated_at), "PP")}</span>
            </div>
          </div>
          <div className="flex gap-2">
            <Button size="sm" variant="outline" onClick={() => onDownload?.(report, "pdf")}>
              <Download className="h-4 w-4 mr-1" /> PDF
            </Button>
            <Button size="sm" variant="outline" onClick={() => onDownload?.(report, "docx")}>
              <Download className="h-4 w-4 mr-1" /> Word
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="p-0 flex-1 overflow-hidden">
        <ScrollArea className="h-full">
          <div className="p-6 max-w-none">
            {sections.map((s, i) => (
              <section key={i} className="mb-6">
                <h2 className="font-bold text-lg uppercase text-[#1E3A5F] border-b-2 border-[#C9A227] pb-1 mb-3">{s.heading}</h2>
                <div>{sectionBlocks(s).map((b, j) => renderBlock(b, j))}</div>
              </section>
            ))}
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  );
}
