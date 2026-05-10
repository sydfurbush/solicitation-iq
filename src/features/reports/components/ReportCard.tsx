import { format } from "date-fns";
import { FileText, FileType, Download, Eye, Trash2, Send, Globe } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { saveAs } from "file-saver";
import { generatePdf } from "../utils/pdfGenerator";
import { generateDocx } from "../utils/wordGenerator";
import { useDeleteReport, usePublishReport, type ReportRow } from "../hooks/useReports";
import { REPORT_TYPE_BY_ID, type ReportContent, type ReportType } from "../templates/types";
import { toast } from "@/hooks/use-toast";

type Props = { report: ReportRow; solicitationId: string; onView: () => void };

export function ReportCard({ report, solicitationId, onView }: Props) {
  const del = useDeleteReport(solicitationId);
  const publish = usePublishReport(solicitationId);
  const content = report.content as unknown as ReportContent;
  const meta = REPORT_TYPE_BY_ID[(report.report_type ?? "executive_summary") as ReportType];

  const handleDownload = async (fmt: "pdf" | "docx") => {
    try {
      if (fmt === "pdf") {
        saveAs(generatePdf(content), `${report.title}.pdf`);
      } else {
        saveAs(await generateDocx(content), `${report.title}.docx`);
      }
    } catch (e) {
      toast({ title: "Download failed", description: e instanceof Error ? e.message : String(e), variant: "destructive" });
    }
  };

  return (
    <Card>
      <CardContent className="p-4 space-y-3">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="font-semibold leading-tight truncate">{report.title}</p>
            <div className="flex items-center gap-2 mt-1 flex-wrap">
              <Badge variant="outline" className="text-[10px]">{meta?.title ?? report.report_type}</Badge>
              <Badge variant="secondary" className="text-[10px]">v{report.version ?? 1}</Badge>
              {report.is_published && <Badge className="text-[10px] bg-emerald-500/15 text-emerald-700 border-emerald-500/30">Published</Badge>}
              {report.client_accessible && <Badge className="text-[10px] bg-blue-500/15 text-blue-700 border-blue-500/30">Client</Badge>}
            </div>
          </div>
          <FileText className="h-5 w-5 text-muted-foreground shrink-0" />
        </div>

        <p className="text-xs text-muted-foreground">
          Generated {report.generated_at ? format(new Date(report.generated_at), "PPp") : "—"}
        </p>

        <div className="flex gap-1 flex-wrap pt-1">
          <Button size="sm" variant="outline" onClick={onView}><Eye className="h-3.5 w-3.5 mr-1" /> View</Button>
          <Button size="sm" variant="outline" onClick={() => handleDownload("pdf")}><Download className="h-3.5 w-3.5 mr-1" /> PDF</Button>
          <Button size="sm" variant="outline" onClick={() => handleDownload("docx")}><FileType className="h-3.5 w-3.5 mr-1" /> Word</Button>
          <Button
            size="sm"
            variant="outline"
            onClick={() => publish.mutate({ reportId: report.id, publish: !report.is_published })}
            title={report.is_published ? "Unpublish" : "Publish"}
          >
            <Send className="h-3.5 w-3.5" />
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={() => publish.mutate({ reportId: report.id, publish: !!report.is_published, clientAccessible: !report.client_accessible })}
            title="Toggle client access"
          >
            <Globe className="h-3.5 w-3.5" />
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={() => {
              if (confirm("Delete this report?")) del.mutate(report.id);
            }}
          >
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
