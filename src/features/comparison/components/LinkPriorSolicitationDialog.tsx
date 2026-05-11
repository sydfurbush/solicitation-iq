import { useState } from "react";
import { useForm } from "react-hook-form";
import { Link2, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "@/hooks/use-toast";
import { useSolicitations, useSolicitation } from "@/features/solicitations/hooks/useSolicitations";
import { useLinkPriorSolicitation } from "../hooks/usePriorSolicitation";
import { useRunComparison } from "../hooks/useRunComparison";
import { useImportPriorFromSam, waitForDocumentsParsed, type ImportProgress } from "../hooks/useImportPriorFromSam";
import { ImportProgressPanel } from "./ImportProgressPanel";

type Props = {
  solicitationId: string;
  trigger?: React.ReactNode;
  onLinked?: () => void;
};

export function LinkPriorSolicitationDialog({ solicitationId, trigger, onLinked }: Props) {
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<"existing" | "external">("existing");
  const [selectedPriorId, setSelectedPriorId] = useState<string | null>(null);

  const { data: current } = useSolicitation(solicitationId);
  const { data: all } = useSolicitations({});
  const candidates = (all ?? []).filter(
    (s) => s.id !== solicitationId && s.client_id === current?.client_id
  );
  const previewPrior = candidates.find((c) => c.id === selectedPriorId);

  const externalForm = useForm({
    defaultValues: { external_reference: "", external_url: "", notes: "" },
  });

  const link = useLinkPriorSolicitation(solicitationId);
  const compare = useRunComparison(solicitationId);
  const importFromSam = useImportPriorFromSam(solicitationId);
  const [progress, setProgress] = useState<ImportProgress | null>(null);

  const busy = link.isPending || importFromSam.isPending || compare.isPending || (!!progress && progress.stage !== "done" && progress.stage !== "error");

  const handleLink = async () => {
    try {
      if (tab === "existing") {
        if (!selectedPriorId) {
          toast({ title: "Select a prior solicitation", variant: "destructive" });
          return;
        }
        const linked = await link.mutateAsync({ priorSolicitationId: selectedPriorId });
        toast({ title: "Prior solicitation linked" });
        onLinked?.();
        compare.mutate({ priorSolicitationId: selectedPriorId, priorRecordId: linked?.id ?? null });
        setOpen(false);
        return;
      }

      // External tab — try to import from SAM so comparison has real content
      const v = externalForm.getValues();
      const ref = v.external_reference?.trim();
      const url = v.external_url?.trim();
      if (!ref && !url) {
        toast({ title: "Enter a reference or SAM URL", variant: "destructive" });
        return;
      }

      try {
        const result = await importFromSam.mutateAsync({
          url: url || null,
          solicitationNumber: ref || null,
          externalReference: ref || null,
          notes: v.notes || null,
          onProgress: setProgress,
        });
        onLinked?.();

        if (result.imported > 0) {
          setProgress({
            stage: "parsing",
            message: `Parsing ${result.imported} document(s)…`,
            found: result.found,
            imported: result.imported,
            failed: result.failed,
            parsed: 0,
            totalDocs: result.imported,
          });
          await waitForDocumentsParsed(result.priorSolicitationId, {
            onProgress: ({ parsed, total }) =>
              setProgress((p) => p && {
                ...p,
                stage: "parsing",
                message: `Parsing documents (${parsed}/${total})…`,
                parsed,
                totalDocs: total,
              }),
          });
        }

        setProgress((p) => p && { ...p, stage: "comparing", message: "Running AI comparison…" });
        await new Promise<void>((resolve, reject) =>
          compare.mutate(
            { priorSolicitationId: result.priorSolicitationId, priorRecordId: result.priorRecordId },
            { onSuccess: () => resolve(), onError: (e) => reject(e) },
          ),
        );

        setProgress((p) => p && {
          ...p,
          stage: "done",
          message: `Done — ${result.imported}/${result.found} attachment(s) imported, comparison updated.`,
        });
        toast({ title: "Comparison updated" });
        setTimeout(() => setOpen(false), 1200);
      } catch (samErr) {
        // Fall back to a plain external-reference link so the user isn't blocked
        console.warn("SAM import failed, falling back to external-reference link", samErr);
        setProgress({
          stage: "error",
          message: `SAM import failed: ${samErr instanceof Error ? samErr.message : String(samErr)}`,
        });
        const linked = await link.mutateAsync({
          externalReference: ref || null,
          externalUrl: url || null,
        });
        toast({
          title: "Linked as external reference",
          description: `Couldn't auto-import from SAM. Comparison will be limited.`,
          variant: "destructive",
        });
        onLinked?.();
        compare.mutate({ priorSolicitationId: null, priorRecordId: linked?.id ?? null });
        setTimeout(() => setOpen(false), 1500);
      }
    } catch (e) {
      toast({ title: "Failed to link", description: e instanceof Error ? e.message : String(e), variant: "destructive" });
      setProgress({ stage: "error", message: e instanceof Error ? e.message : String(e) });
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger ?? (
          <Button>
            <Link2 className="mr-2 h-4 w-4" /> Link prior solicitation
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Link prior solicitation</DialogTitle>
          <DialogDescription>Compare this solicitation to a previous version.</DialogDescription>
        </DialogHeader>

        <Tabs value={tab} onValueChange={(v) => setTab(v as "existing" | "external")}>
          <TabsList>
            <TabsTrigger value="existing">From this client</TabsTrigger>
            <TabsTrigger value="external">External reference</TabsTrigger>
          </TabsList>

          <TabsContent value="existing" className="space-y-3">
            {candidates.length === 0 ? (
              <p className="text-sm text-muted-foreground py-6 text-center">
                No other solicitations for this client.
              </p>
            ) : (
              <>
                <Label>Prior solicitation</Label>
                <Select value={selectedPriorId ?? ""} onValueChange={setSelectedPriorId}>
                  <SelectTrigger><SelectValue placeholder="Select a solicitation" /></SelectTrigger>
                  <SelectContent>
                    {candidates.map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.solicitation_number ? `[${c.solicitation_number}] ` : ""}{c.title}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {previewPrior && (
                  <div className="rounded-md border p-3 text-sm space-y-1 bg-muted/30">
                    <p className="font-medium">{previewPrior.title}</p>
                    <p className="text-muted-foreground">{previewPrior.issuing_agency ?? "—"}</p>
                    <p className="text-xs text-muted-foreground">
                      Status: {previewPrior.status} • {previewPrior.documents_count} docs
                    </p>
                  </div>
                )}
              </>
            )}
          </TabsContent>

          <TabsContent value="external" className="space-y-3">
            <div className="space-y-2">
              <Label htmlFor="ref">Reference (contract or solicitation #)</Label>
              <Input id="ref" {...externalForm.register("external_reference")} placeholder="e.g. W912DY-19-R-0001" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="url">URL (optional)</Label>
              <Input id="url" {...externalForm.register("external_url")} placeholder="https://sam.gov/..." />
            </div>
            <div className="space-y-2">
              <Label htmlFor="notes">Notes (optional)</Label>
              <Textarea id="notes" {...externalForm.register("notes")} rows={3} />
            </div>
            <p className="text-xs text-muted-foreground">
              We'll look up SAM.gov, create a shadow prior solicitation, and pull its attachments so the comparison has real content to diff.
            </p>
          </TabsContent>
        </Tabs>

        <DialogFooter>
          {stage && <span className="text-xs text-muted-foreground mr-auto">{stage}</span>}
          <Button variant="outline" onClick={() => setOpen(false)} disabled={busy}>Cancel</Button>
          <Button onClick={handleLink} disabled={busy}>
            <ExternalLink className="mr-2 h-4 w-4" /> {busy ? "Working…" : "Link & compare"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
