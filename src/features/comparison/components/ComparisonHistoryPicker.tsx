import { useEffect, useState } from "react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { History, Pencil } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { useComparisonRuns, useUpdateRunLabel, type ComparisonRun } from "../hooks/useComparisonRuns";

type Props = {
  priorSolicitationRecordId: string;
  selectedRunId: string | null;
  onSelectRun: (runId: string | null) => void;
};

export function ComparisonHistoryPicker({ priorSolicitationRecordId, selectedRunId, onSelectRun }: Props) {
  const { data: runs = [] } = useComparisonRuns(priorSolicitationRecordId);
  const updateLabel = useUpdateRunLabel(priorSolicitationRecordId);
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState("");

  // The run we'd edit: explicitly selected, otherwise the latest (top) run.
  const targetRun: ComparisonRun | undefined =
    (selectedRunId ? runs.find((r) => r.id === selectedRunId) : runs[0]) ?? undefined;

  useEffect(() => {
    if (open) setDraft(targetRun?.label ?? "");
  }, [open, targetRun?.id, targetRun?.label]);

  if (runs.length === 0) return null;

  const formatRun = (r: ComparisonRun) => {
    const date = new Date(r.created_at).toLocaleString();
    return r.label ? `#${r.run_number} · ${r.label} · ${date}` : `#${r.run_number} · ${date}`;
  };

  const handleSave = async () => {
    if (!targetRun) return;
    try {
      await updateLabel.mutateAsync({ runId: targetRun.id, label: draft.trim() ? draft.trim() : null });
      toast({ title: "Label saved" });
      setOpen(false);
    } catch (e) {
      toast({ title: "Failed to save label", description: e instanceof Error ? e.message : String(e), variant: "destructive" });
    }
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

      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            className="h-9 w-9"
            disabled={!targetRun}
            title={targetRun ? `Label run #${targetRun.run_number}` : "No run to label"}
          >
            <Pencil className="h-4 w-4" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-72 space-y-2" align="end">
          <p className="text-sm font-medium">
            Label run {targetRun ? `#${targetRun.run_number}` : ""}
          </p>
          <Input
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder='e.g. "Baseline" or "After Amendment 3"'
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                void handleSave();
              }
            }}
            autoFocus
          />
          <div className="flex justify-end gap-2">
            <Button variant="ghost" size="sm" onClick={() => setOpen(false)} disabled={updateLabel.isPending}>
              Cancel
            </Button>
            <Button size="sm" onClick={() => void handleSave()} disabled={updateLabel.isPending}>
              {updateLabel.isPending ? "Saving…" : "Save"}
            </Button>
          </div>
        </PopoverContent>
      </Popover>
    </div>
  );
}
