import { useState } from "react";
import { FileBarChart, Plus } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { useReports, useGenerateReport, type ReportRow } from "@/features/reports/hooks/useReports";
import { ReportTypeSelector } from "@/features/reports/components/ReportTypeSelector";
import { ReportOptionsDialog } from "@/features/reports/components/ReportOptionsDialog";
import { ReportCard } from "@/features/reports/components/ReportCard";
import { ReportViewer } from "@/features/reports/components/ReportViewer";
import type { ReportType, ReportOptions } from "@/features/reports/templates/types";
import { toast } from "@/hooks/use-toast";

export default function SolicitationReports({ solicitationId }: { solicitationId: string }) {
  const { data: reports, isLoading } = useReports(solicitationId);
  const generate = useGenerateReport(solicitationId);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [optionsType, setOptionsType] = useState<ReportType | null>(null);
  const [viewing, setViewing] = useState<ReportRow | null>(null);

  const handleGenerate = (options: ReportOptions) => {
    if (!optionsType) return;
    generate.mutate(
      { reportType: optionsType, options },
      {
        onSuccess: () => {
          toast({ title: "Report generated" });
          setOptionsType(null);
          setPickerOpen(false);
        },
        onError: (e) => toast({ title: "Generation failed", description: e instanceof Error ? e.message : String(e), variant: "destructive" }),
      }
    );
  };

  const NewReportButton = (
    <Dialog open={pickerOpen} onOpenChange={setPickerOpen}>
      <DialogTrigger asChild><Button><Plus className="mr-2 h-4 w-4" /> Generate report</Button></DialogTrigger>
      <DialogContent className="sm:max-w-3xl">
        <DialogHeader><DialogTitle>Choose a report type</DialogTitle></DialogHeader>
        <ReportTypeSelector onSelect={(t) => setOptionsType(t)} recommended={["executive_summary", "full_analysis"]} />
      </DialogContent>
    </Dialog>
  );

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold">Reports</h2>
          <p className="text-sm text-muted-foreground">{reports?.length ?? 0} report{reports?.length === 1 ? "" : "s"}</p>
        </div>
        {NewReportButton}
      </div>

      {isLoading ? (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-40" />)}
        </div>
      ) : !reports || reports.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center space-y-3">
            <div className="mx-auto h-12 w-12 rounded-full bg-primary/10 text-primary flex items-center justify-center">
              <FileBarChart className="h-6 w-6" />
            </div>
            <p className="font-medium">No reports yet</p>
            <p className="text-sm text-muted-foreground">Generate professional deliverables from your analysis.</p>
            <div className="pt-2">{NewReportButton}</div>
          </CardContent>
        </Card>
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {reports.map((r) => (
            <ReportCard key={r.id} report={r} solicitationId={solicitationId} onView={() => setViewing(r)} />
          ))}
        </div>
      )}

      <ReportOptionsDialog
        open={!!optionsType}
        onOpenChange={(v) => !v && setOptionsType(null)}
        reportType={optionsType}
        onConfirm={handleGenerate}
        loading={generate.isPending}
      />

      <ReportViewer report={viewing} open={!!viewing} onOpenChange={(v) => !v && setViewing(null)} />
    </div>
  );
}
