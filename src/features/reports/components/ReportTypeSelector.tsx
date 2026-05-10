import { FileText, Briefcase, HelpCircle, ShieldAlert, Lightbulb, GitCompare, ListTree } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { REPORT_TYPES, type ReportType } from "../templates/types";

const ICONS: Record<ReportType, typeof FileText> = {
  executive_summary: Briefcase,
  full_analysis: FileText,
  questions_brief: HelpCircle,
  risk_assessment: ShieldAlert,
  opportunity_brief: Lightbulb,
  comparison_report: GitCompare,
  proposal_outline: ListTree,
};

export function ReportTypeSelector({ onSelect, recommended }: { onSelect: (t: ReportType) => void; recommended?: ReportType[] }) {
  return (
    <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
      {REPORT_TYPES.map((t) => {
        const Icon = ICONS[t.id];
        const isRec = recommended?.includes(t.id);
        return (
          <Card key={t.id} className={isRec ? "border-primary/40" : ""}>
            <CardContent className="p-4 space-y-3">
              <div className="flex items-start gap-3">
                <div className="rounded-md bg-primary/10 text-primary p-2"><Icon className="h-5 w-5" /></div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="font-semibold leading-tight">{t.title}</p>
                    {isRec && <Badge variant="secondary" className="text-[10px]">Recommended</Badge>}
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">{t.description}</p>
                  <p className="text-[10px] text-muted-foreground mt-1">~{t.estimatedTime}</p>
                </div>
              </div>
              <Button size="sm" className="w-full" onClick={() => onSelect(t.id)}>Generate</Button>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
