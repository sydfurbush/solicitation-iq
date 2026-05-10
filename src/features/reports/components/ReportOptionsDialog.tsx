import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { REPORT_TYPE_BY_ID, type ReportType, type ReportOptions } from "../templates/types";

type Props = {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  reportType: ReportType | null;
  onConfirm: (options: ReportOptions) => void;
  loading?: boolean;
};

export function ReportOptionsDialog({ open, onOpenChange, reportType, onConfirm, loading }: Props) {
  const [includeCitations, setIncludeCitations] = useState(true);
  const [includeRecommendations, setIncludeRecommendations] = useState(true);
  const [outputFormat, setOutputFormat] = useState<"pdf" | "docx" | "both" | "none">("pdf");

  const meta = reportType ? REPORT_TYPE_BY_ID[reportType] : null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Generate {meta?.title ?? "report"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="flex items-center justify-between">
            <Label htmlFor="cit">Include source citations</Label>
            <Switch id="cit" checked={includeCitations} onCheckedChange={setIncludeCitations} />
          </div>
          <div className="flex items-center justify-between">
            <Label htmlFor="rec">Include recommendations</Label>
            <Switch id="rec" checked={includeRecommendations} onCheckedChange={setIncludeRecommendations} />
          </div>
          <div>
            <Label>Output format</Label>
            <div className="flex gap-2 mt-2">
              {(["pdf", "docx", "both", "none"] as const).map((f) => (
                <Button key={f} size="sm" variant={outputFormat === f ? "default" : "outline"} onClick={() => setOutputFormat(f)}>
                  {f.toUpperCase()}
                </Button>
              ))}
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button
            onClick={() => onConfirm({ includeCitations, includeRecommendations, outputFormat })}
            disabled={loading}
          >
            {loading ? "Generating…" : "Generate report"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
