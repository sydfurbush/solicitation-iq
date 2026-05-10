import { Download, FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { format } from "date-fns";

interface Props {
  report: any;
  onDownload?: (report: any, fmt: "pdf" | "docx") => void;
}

function renderMarkdownLite(md: string) {
  return md
    .split("\n")
    .map((line, i) => {
      if (line.startsWith("# ")) return <h1 key={i} className="text-2xl font-bold mt-6 mb-3">{line.slice(2)}</h1>;
      if (line.startsWith("## ")) return <h2 key={i} className="text-xl font-semibold mt-5 mb-2">{line.slice(3)}</h2>;
      if (line.startsWith("### ")) return <h3 key={i} className="text-lg font-semibold mt-4 mb-2">{line.slice(4)}</h3>;
      if (line.startsWith("- ")) return <li key={i} className="ml-5 list-disc">{line.slice(2)}</li>;
      if (!line.trim()) return <div key={i} className="h-2" />;
      return <p key={i} className="text-sm leading-relaxed">{line}</p>;
    });
}

export function ClientReportViewer({ report, onDownload }: Props) {
  const sections = (report?.content?.sections ?? []) as Array<{ heading: string; body: string }>;
  const fullMarkdown = report?.content?.markdown ?? "";

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
          <div className="p-6 prose prose-sm max-w-none">
            {sections.length > 0
              ? sections.map((s, i) => (
                  <section key={i} className="mb-6">
                    <h2 className="text-xl font-semibold mb-2">{s.heading}</h2>
                    <div>{renderMarkdownLite(s.body)}</div>
                  </section>
                ))
              : renderMarkdownLite(fullMarkdown)}
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  );
}
