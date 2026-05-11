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
import { useImportPriorFromSam, waitForDocumentsParsed } from "../hooks/useImportPriorFromSam";

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

  const handleLink = async () => {
    try {
      let linked;
      if (tab === "existing") {
        if (!selectedPriorId) {
          toast({ title: "Select a prior solicitation", variant: "destructive" });
          return;
        }
        linked = await link.mutateAsync({ priorSolicitationId: selectedPriorId });
      } else {
        const v = externalForm.getValues();
        if (!v.external_reference) {
          toast({ title: "Enter a reference", variant: "destructive" });
          return;
        }
        linked = await link.mutateAsync({
          externalReference: v.external_reference,
          externalUrl: v.external_url || null,
        });
      }
      toast({ title: "Prior solicitation linked" });
      onLinked?.();
      // Auto-run comparison
      compare.mutate({
        priorSolicitationId: tab === "existing" ? selectedPriorId : null,
        priorRecordId: linked?.id ?? null,
      });
      setOpen(false);
    } catch (e) {
      toast({ title: "Failed to link", description: e instanceof Error ? e.message : String(e), variant: "destructive" });
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
          </TabsContent>
        </Tabs>

        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
          <Button onClick={handleLink} disabled={link.isPending}>
            <ExternalLink className="mr-2 h-4 w-4" /> Link &amp; compare
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
