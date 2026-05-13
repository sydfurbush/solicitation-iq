import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { useDocuments } from "@/features/documents/hooks/useDocuments";
import { useCreateRevision, useAssignDocumentsToRevision, type RevisionKind } from "../hooks/useRevisions";
import { toast } from "@/hooks/use-toast";

type Props = {
  open: boolean;
  onClose: () => void;
  solicitationId: string;
};

export function AddRevisionDialog({ open, onClose, solicitationId }: Props) {
  const [label, setLabel] = useState("");
  const [kind, setKind] = useState<RevisionKind>("amendment");
  const [notes, setNotes] = useState("");
  const [selectedDocs, setSelectedDocs] = useState<Set<string>>(new Set());
  const { data: docs, isLoading } = useDocuments(solicitationId);
  const create = useCreateRevision(solicitationId);
  const assign = useAssignDocumentsToRevision(solicitationId);

  const reset = () => {
    setLabel(""); setKind("amendment"); setNotes(""); setSelectedDocs(new Set());
  };

  const submit = async () => {
    if (!label.trim()) {
      toast({ title: "Label required", variant: "destructive" });
      return;
    }
    try {
      const rev = await create.mutateAsync({ label: label.trim(), kind, notes: notes.trim() || null });
      if (selectedDocs.size > 0) {
        await assign.mutateAsync({ documentIds: Array.from(selectedDocs), revisionId: rev.id });
      }
      toast({ title: "Revision added", description: `${label} created with ${selectedDocs.size} document(s).` });
      reset();
      onClose();
    } catch (e) {
      toast({ title: "Failed", description: e instanceof Error ? e.message : String(e), variant: "destructive" });
    }
  };

  const toggle = (id: string) => {
    setSelectedDocs((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && (onClose(), reset())}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Add revision</DialogTitle>
          <DialogDescription>Group documents into a new revision (e.g., Amendment 0001, Final RFP).</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1">
            <Label>Label</Label>
            <Input value={label} onChange={(e) => setLabel(e.target.value)} placeholder="Amendment 0001" />
          </div>
          <div className="space-y-1">
            <Label>Kind</Label>
            <Select value={kind} onValueChange={(v) => setKind(v as RevisionKind)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="pre_sol">Pre-solicitation</SelectItem>
                <SelectItem value="amendment">Amendment</SelectItem>
                <SelectItem value="final">Final RFP</SelectItem>
                <SelectItem value="draft">Draft</SelectItem>
                <SelectItem value="other">Other</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label>Notes</Label>
            <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} />
          </div>
          <div className="space-y-1">
            <Label>Assign existing documents (optional)</Label>
            <ScrollArea className="h-40 border rounded-md p-2">
              {isLoading ? <Skeleton className="h-24" /> : (docs ?? []).length === 0 ? (
                <p className="text-xs text-muted-foreground p-2">No documents uploaded yet.</p>
              ) : (
                <ul className="space-y-1">
                  {(docs ?? []).map((d) => (
                    <li key={d.id} className="flex items-center gap-2 text-sm">
                      <Checkbox checked={selectedDocs.has(d.id)} onCheckedChange={() => toggle(d.id)} id={`doc-${d.id}`} />
                      <label htmlFor={`doc-${d.id}`} className="cursor-pointer flex-1 truncate">{d.file_name}</label>
                    </li>
                  ))}
                </ul>
              )}
            </ScrollArea>
            <p className="text-xs text-muted-foreground">Tip: upload new documents from the Documents tab, then re-open this dialog to assign them.</p>
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => { onClose(); reset(); }}>Cancel</Button>
          <Button onClick={submit} disabled={create.isPending || assign.isPending}>
            {create.isPending || assign.isPending ? "Saving…" : "Add revision"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
