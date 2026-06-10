import { useState } from "react";
import { formatSupabaseError } from "@/lib/supabase/formatError";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "@/hooks/use-toast";
import { Sparkles } from "lucide-react";
import { useCreateFinalFromPreSol } from "../hooks/useFinalFromPreSol";
import { STAGE_LABELS, type SolicitationStage } from "../lib/stage";

interface Props {
  sourceId: string;
  sourceTitle: string;
  sourceStage: SolicitationStage;
  trigger?: React.ReactNode;
}

const NEXT_STAGES: SolicitationStage[] = ["final", "draft_rfp", "amendment"];

export function AddFinalSolicitationDialog({ sourceId, sourceTitle, sourceStage, trigger }: Props) {
  const [open, setOpen] = useState(false);
  const [stage, setStage] = useState<SolicitationStage>("final");
  const [title, setTitle] = useState(sourceTitle);
  const [stageLabel, setStageLabel] = useState("");
  const [snapshot, setSnapshot] = useState(true);
  const [snapshotLabel, setSnapshotLabel] = useState(
    `${STAGE_LABELS[sourceStage]} baseline ${new Date().toISOString().slice(0, 10)}`
  );

  const createMut = useCreateFinalFromPreSol();
  const navigate = useNavigate();

  const submit = async () => {
    try {
      const newId = await createMut.mutateAsync({
        sourceSolicitationId: sourceId,
        newStage: stage,
        stageLabel: stageLabel.trim() || null,
        newTitle: title.trim() || null,
        snapshot,
        snapshotLabel: snapshotLabel.trim() || null,
      });
      toast({
        title: "Created",
        description: `${STAGE_LABELS[stage]} solicitation created and linked.`,
      });
      setOpen(false);
      navigate(`/solicitations/${newId}?tab=phase-1&step=documents`);
    } catch (e) {
      console.error("Create next-stage solicitation failed:", e);
      toast({ title: "Failed", description: formatSupabaseError(e), variant: "destructive" });
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger ?? (
          <Button size="sm" variant="default">
            <Sparkles className="h-4 w-4 mr-1" />
            Add Final Solicitation
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Create next-stage solicitation</DialogTitle>
          <DialogDescription>
            Snapshot this {STAGE_LABELS[sourceStage]} record and create a new linked solicitation. Phase 1 analysis will
            re-run on the new documents; this record stays active and editable.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="space-y-1.5">
            <Label>Stage</Label>
            <Select value={stage} onValueChange={(v) => setStage(v as SolicitationStage)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {NEXT_STAGES.map((s) => (
                  <SelectItem key={s} value={s}>{STAGE_LABELS[s]}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label>Title</Label>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} />
          </div>

          <div className="space-y-1.5">
            <Label>Stage label (optional)</Label>
            <Input
              placeholder={stage === "amendment" ? "e.g. Amendment 0002" : "e.g. Final RFP"}
              value={stageLabel}
              onChange={(e) => setStageLabel(e.target.value)}
            />
          </div>

          <div className="rounded-md border p-3 space-y-2">
            <label className="flex items-start gap-2 cursor-pointer">
              <Checkbox checked={snapshot} onCheckedChange={(v) => setSnapshot(!!v)} className="mt-0.5" />
              <div className="space-y-1">
                <div className="text-sm font-medium">Snapshot current analysis</div>
                <div className="text-xs text-muted-foreground">
                  Freezes a read-only copy of requirements, risks, questions, opportunities, gaps, and section analyses
                  for before/after comparison.
                </div>
              </div>
            </label>
            {snapshot && (
              <Input
                className="mt-2"
                value={snapshotLabel}
                onChange={(e) => setSnapshotLabel(e.target.value)}
                placeholder="Snapshot label"
              />
            )}
          </div>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => setOpen(false)} disabled={createMut.isPending}>Cancel</Button>
          <Button onClick={submit} disabled={createMut.isPending}>
            {createMut.isPending ? "Creating…" : "Create & open"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
