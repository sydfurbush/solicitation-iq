import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Sparkles } from "lucide-react";
import { DOCUMENT_TYPES, DOCUMENT_TYPE_LABELS, type DocumentType } from "../utils/fileHelpers";

type Item = { id: string; filename: string; suggested: DocumentType };

type Props = {
  items: Item[];
  onConfirm: (assignments: Record<string, DocumentType>) => void;
  onCancel: () => void;
};

export function DocumentTypeSelector({ items, onConfirm, onCancel }: Props) {
  const [bulkType, setBulkType] = useState<DocumentType | "">("");
  const [assignments, setAssignments] = useState<Record<string, DocumentType>>(
    Object.fromEntries(items.map((i) => [i.id, i.suggested])) as Record<string, DocumentType>
  );

  const applyBulk = () => {
    if (!bulkType) return;
    setAssignments(Object.fromEntries(items.map((i) => [i.id, bulkType])) as Record<string, DocumentType>);
  };

  return (
    <Dialog open onOpenChange={(open) => !open && onCancel()}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Classify documents</DialogTitle>
          <DialogDescription>
            Suggested types are based on the filename. Confirm or adjust before uploading.
          </DialogDescription>
        </DialogHeader>

        {items.length > 1 && (
          <div className="flex items-end gap-2 rounded-md bg-muted/40 p-3">
            <div className="flex-1">
              <label className="text-xs text-muted-foreground mb-1 block">Bulk classify all</label>
              <Select value={bulkType} onValueChange={(v) => setBulkType(v as DocumentType)}>
                <SelectTrigger>
                  <SelectValue placeholder="Choose a type to apply to all…" />
                </SelectTrigger>
                <SelectContent>
                  {DOCUMENT_TYPES.map((t) => (
                    <SelectItem key={t} value={t}>
                      {DOCUMENT_TYPE_LABELS[t]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Button variant="outline" onClick={applyBulk} disabled={!bulkType}>
              Apply
            </Button>
          </div>
        )}

        <ul className="space-y-2 max-h-80 overflow-auto">
          {items.map((item) => (
            <li key={item.id} className="flex items-center gap-3 rounded-md border p-3">
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{item.filename}</p>
                <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                  <Sparkles className="h-3 w-3" /> Suggested: {DOCUMENT_TYPE_LABELS[item.suggested]}
                </p>
              </div>
              <div className="w-56">
                <Select
                  value={assignments[item.id]}
                  onValueChange={(v) =>
                    setAssignments((prev) => ({ ...prev, [item.id]: v as DocumentType }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {DOCUMENT_TYPES.map((t) => (
                      <SelectItem key={t} value={t}>
                        {DOCUMENT_TYPE_LABELS[t]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </li>
          ))}
        </ul>

        <DialogFooter>
          <Button variant="outline" onClick={onCancel}>
            Cancel
          </Button>
          <Button onClick={() => onConfirm(assignments)}>Upload {items.length} file(s)</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
