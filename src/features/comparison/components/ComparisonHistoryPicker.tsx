import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { History } from "lucide-react";
import { useComparisonRuns, type ComparisonRun } from "../hooks/useComparisonRuns";

type Props = {
  priorSolicitationRecordId: string;
  selectedRunId: string | null;
  onSelectRun: (runId: string | null) => void;
};

export function ComparisonHistoryPicker({ priorSolicitationRecordId, selectedRunId, onSelectRun }: Props) {
  const { data: runs = [] } = useComparisonRuns(priorSolicitationRecordId);
  if (runs.length === 0) return null;

  const formatRun = (r: ComparisonRun) => {
    const date = new Date(r.created_at).toLocaleString();
    return r.label ? `#${r.run_number} · ${r.label} · ${date}` : `#${r.run_number} · ${date}`;
  };

  return (
    <div className="flex items-center gap-2">
      <History className="h-4 w-4 text-muted-foreground" />
      <Select
        value={selectedRunId ?? "latest"}
        onValueChange={(v) => onSelectRun(v === "latest" ? null : v)}
      >
        <SelectTrigger className="w-[320px] h-9">
          <SelectValue placeholder="Latest run" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="latest">Latest run</SelectItem>
          {runs.map((r) => (
            <SelectItem key={r.id} value={r.id}>
              {formatRun(r)}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
