import { useState } from "react";
import { Loader2, Sparkles } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { toast } from "@/hooks/use-toast";
import { useGenerateQuestions } from "../hooks/useStrategicQuestions";

const FOCUS_OPTIONS = ["Technical", "Management", "Pricing", "Compliance", "Staffing"];

interface Props {
  solicitationId: string;
  documents: Array<{ id: string; file_name: string }>;
  hasExistingAi: boolean;
  open: boolean;
  onOpenChange: (o: boolean) => void;
}

export function GenerateQuestionsDialog({ solicitationId, documents, hasExistingAi, open, onOpenChange }: Props) {
  const [focusAreas, setFocusAreas] = useState<string[]>([]);
  const [docIds, setDocIds] = useState<string[]>([]);
  const [regenerate, setRegenerate] = useState(false);
  const generate = useGenerateQuestions(solicitationId);

  const toggle = (arr: string[], v: string) => arr.includes(v) ? arr.filter((x) => x !== v) : [...arr, v];

  const handleRun = async () => {
    try {
      const result = await generate.mutateAsync({
        focusAreas: focusAreas.length ? focusAreas : undefined,
        focusDocumentIds: docIds.length ? docIds : undefined,
        regenerate,
      });
      toast({ title: "Questions generated", description: `${result?.count ?? 0} questions added.` });
      onOpenChange(false);
    } catch (e) {
      toast({ title: "Generation failed", description: e instanceof Error ? e.message : String(e), variant: "destructive" });
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-primary" /> Generate strategic questions
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {hasExistingAi && (
            <Alert>
              <AlertDescription className="text-sm">
                AI-generated questions already exist. Enable "Replace existing" to regenerate them.
              </AlertDescription>
            </Alert>
          )}

          <div className="space-y-2">
            <Label>Focus areas (optional)</Label>
            <div className="flex flex-wrap gap-2">
              {FOCUS_OPTIONS.map((f) => (
                <label key={f} className="flex items-center gap-2 rounded-md border px-3 py-1.5 text-sm cursor-pointer">
                  <Checkbox checked={focusAreas.includes(f)} onCheckedChange={() => setFocusAreas((s) => toggle(s, f))} />
                  {f}
                </label>
              ))}
            </div>
          </div>

          <div className="space-y-2">
            <Label>Limit to documents (optional)</Label>
            <ScrollArea className="h-32 rounded-md border p-2">
              {documents.length === 0 ? (
                <p className="text-sm text-muted-foreground p-2">No processed documents available.</p>
              ) : (
                documents.map((d) => (
                  <label key={d.id} className="flex items-center gap-2 py-1 text-sm">
                    <Checkbox checked={docIds.includes(d.id)} onCheckedChange={() => setDocIds((s) => toggle(s, d.id))} />
                    <span className="truncate">{d.file_name}</span>
                  </label>
                ))
              )}
            </ScrollArea>
          </div>

          <label className="flex items-center gap-2 text-sm">
            <Checkbox checked={regenerate} onCheckedChange={(c) => setRegenerate(c === true)} />
            Replace existing AI-generated questions
          </label>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={generate.isPending}>Cancel</Button>
          <Button onClick={handleRun} disabled={generate.isPending || documents.length === 0}>
            {generate.isPending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Sparkles className="h-4 w-4 mr-2" />}
            Generate
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
