import { useMemo, useState } from "react";
import { Download, ListChecks } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { CitationLink } from "./CitationLink";
import {
  useUpdateRequirementCompliance,
} from "../hooks/useAnalysis";
import type { AnalysisRequirement } from "../prompts/solicitationAnalysis";

const PRIORITY_CLASSES: Record<AnalysisRequirement["priority"], string> = {
  critical: "bg-destructive/15 text-destructive border-destructive/20",
  high: "bg-amber-500/15 text-amber-700 dark:text-amber-400 border-amber-500/20",
  medium: "bg-primary/10 text-primary border-primary/20",
  low: "bg-muted text-muted-foreground border-border",
};

const COMPLIANCE_OPTIONS = [
  { value: "unknown", label: "Unknown" },
  { value: "met", label: "Met" },
  { value: "partial", label: "Partial" },
  { value: "not_met", label: "Not met" },
] as const;

interface Props {
  solicitationId: string;
  requirements: AnalysisRequirement[];
}

export function KeyRequirementsCard({ solicitationId, requirements }: Props) {
  const [filter, setFilter] = useState<string>("all");
  const update = useUpdateRequirementCompliance(solicitationId);

  const filtered = useMemo(() => {
    if (filter === "all") return requirements;
    return requirements.filter((r) => r.priority === filter);
  }, [requirements, filter]);

  const updateCompliance = (id: string, status: AnalysisRequirement["compliance_status"]) => {
    const next = requirements.map((r) => (r.id === id ? { ...r, compliance_status: status } : r));
    update.mutate({ requirements: next });
  };

  const exportCsv = () => {
    const header = ["ID", "Priority", "Category", "Requirement", "Compliance", "Document", "Section", "Page"];
    const rows = requirements.map((r) => [
      r.id,
      r.priority,
      r.category,
      `"${r.text.replace(/"/g, '""')}"`,
      r.compliance_status ?? "unknown",
      r.source?.document ?? "",
      r.source?.section ?? "",
      r.source?.page ?? "",
    ]);
    const csv = [header, ...rows].map((row) => row.join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "key-requirements.csv";
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <Card className="lg:col-span-2">
      <CardHeader className="flex-row items-center justify-between space-y-0">
        <CardTitle className="flex items-center gap-2 text-base">
          <ListChecks className="h-4 w-4 text-primary" />
          Key requirements
          <Badge variant="secondary" className="ml-2">{requirements.length}</Badge>
        </CardTitle>
        <div className="flex gap-2">
          <Select value={filter} onValueChange={setFilter}>
            <SelectTrigger className="h-8 w-32">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All priorities</SelectItem>
              <SelectItem value="critical">Critical</SelectItem>
              <SelectItem value="high">High</SelectItem>
              <SelectItem value="medium">Medium</SelectItem>
              <SelectItem value="low">Low</SelectItem>
            </SelectContent>
          </Select>
          <Button variant="outline" size="sm" onClick={exportCsv} disabled={!requirements.length}>
            <Download className="h-4 w-4 mr-1" /> CSV
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {filtered.length === 0 ? (
          <p className="text-sm text-muted-foreground italic py-6 text-center">No requirements match.</p>
        ) : (
          filtered.map((req) => (
            <div key={req.id} className="rounded-md border p-3 space-y-2">
              <div className="flex items-start gap-2">
                <Badge variant="outline" className={PRIORITY_CLASSES[req.priority]}>
                  {req.priority}
                </Badge>
                <Badge variant="secondary" className="text-[10px] capitalize">{req.category}</Badge>
                <span className="text-[10px] text-muted-foreground font-mono ml-auto">{req.id}</span>
              </div>
              <p className="text-sm">{req.text}</p>
              <div className="flex flex-wrap items-center gap-3 justify-between">
                <CitationLink
                  document={req.source?.document}
                  section={req.source?.section}
                  page={req.source?.page}
                  quote={req.source?.quote}
                />
                <Select
                  value={req.compliance_status ?? "unknown"}
                  onValueChange={(v) => updateCompliance(req.id, v as AnalysisRequirement["compliance_status"])}
                >
                  <SelectTrigger className="h-7 w-32 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {COMPLIANCE_OPTIONS.map((o) => (
                      <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          ))
        )}
      </CardContent>
    </Card>
  );
}
