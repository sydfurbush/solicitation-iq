import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, Sparkles } from "lucide-react";
import { useGeneratePreset, type GeneratedPresetDraft } from "../hooks/useGeneratePreset";
import { toast } from "sonner";

export function AIGenerateDialog({
  open,
  onClose,
  onGenerated,
}: {
  open: boolean;
  onClose: () => void;
  onGenerated: (draft: GeneratedPresetDraft) => void;
}) {
  const [category, setCategory] = useState("");
  const [family, setFamily] = useState<"federal" | "utility">("federal");
  const [buyers, setBuyers] = useState("");
  const [context, setContext] = useState("");
  const generate = useGeneratePreset();

  const submit = async () => {
    if (category.trim().length < 3) {
      toast.error("Service category is required (3+ characters)");
      return;
    }
    try {
      const draft = await generate.mutateAsync({
        category: category.trim(),
        family,
        buyers: buyers.trim() || undefined,
        context: context.trim() || undefined,
      });
      onGenerated(draft);
      onClose();
    } catch {
      // toast handled in hook
    }
  };

  const isPending = generate.isPending;

  return (
    <Dialog open={open} onOpenChange={(v) => !v && !isPending && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-primary" /> Generate preset with AI
          </DialogTitle>
          <DialogDescription>
            Describe the service category. AI will draft a complete preset using your existing built-ins as a reference. You'll review every field before saving.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Service category *</Label>
            <Input
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              placeholder="e.g. Federal Cybersecurity Services"
              maxLength={200}
              disabled={isPending}
            />
          </div>

          <div className="space-y-2">
            <Label>Family</Label>
            <Select value={family} onValueChange={(v) => setFamily(v as "federal" | "utility")} disabled={isPending}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="federal">Federal contracting</SelectItem>
                <SelectItem value="utility">Utility supplier</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Primary buyers (optional)</Label>
            <Input
              value={buyers}
              onChange={(e) => setBuyers(e.target.value)}
              placeholder="DoD, DHS CISA, civilian agency CIOs"
              maxLength={500}
              disabled={isPending}
            />
          </div>

          <div className="space-y-2">
            <Label>Differentiators / context (optional)</Label>
            <Textarea
              value={context}
              onChange={(e) => setContext(e.target.value)}
              placeholder="FedRAMP High, CMMC L3, cleared workforce, OT-segmented architecture…"
              rows={3}
              maxLength={2000}
              disabled={isPending}
            />
          </div>

          {isPending && (
            <div className="rounded-md border border-dashed p-3 text-sm text-muted-foreground flex items-center gap-2">
              <Loader2 className="h-4 w-4 animate-spin" />
              Generating preset… this typically takes 10–20 seconds.
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={isPending}>Cancel</Button>
          <Button onClick={submit} disabled={isPending || category.trim().length < 3}>
            {isPending ? (<><Loader2 className="h-4 w-4 mr-2 animate-spin" />Generating…</>) : (<><Sparkles className="h-4 w-4 mr-2" />Generate</>)}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
