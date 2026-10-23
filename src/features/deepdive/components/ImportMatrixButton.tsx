import { useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { FileUp, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { useCanEditRequirementLinks } from "@/features/outline/hooks/useRequirementLinks";
import { toast } from "sonner";
import { validateMatrixFile, WORKFLOW_LABELS } from "../utils/matrix";

interface Preview {
  sheet: string; rows: number; skipped: number; newRequirements: number; refreshedRequirements: number;
  groupedExistingItems: number; standaloneExistingItems: number; byStatus: Record<string, number>;
  needingClarification: number; columnsFound: string[]; mastersLinkedToOutline?: number;
}
export function ImportMatrixButton({ solicitationId }: { solicitationId: string }) {
  const canEdit = useCanEditRequirementLinks();
  const input = useRef<HTMLInputElement>(null);
  const qc = useQueryClient();
  const [busy, setBusy] = useState(false);
  const [preview, setPreview] = useState<Preview | null>(null);
  const [file, setFile] = useState<{ fileName: string; fileBase64: string } | null>(null);
  const invoke = async (payload: { fileName: string; fileBase64: string }, apply: boolean) => {
    const { data, error } = await supabase.functions.invoke("import-compliance-matrix", { body: { solicitationId, ...payload, apply } });
    if (error) {
      if (error.context instanceof Response) {
        const body = await error.context.json().catch(() => null);
        if (body?.error) throw new Error(body.error);
      }
      throw error;
    }
    if (data?.error) throw new Error(data.error);
    return data as Preview;
  };
  const choose = async (selected: File | undefined) => {
    if (!selected) return;
    const validation = validateMatrixFile(selected);
    if (validation) { toast.error(validation); return; }
    setBusy(true);
    try {
      const fileBase64 = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result).split(",")[1]);
        reader.onerror = () => reject(new Error("Could not read this file"));
        reader.readAsDataURL(selected);
      });
      const payload = { fileName: selected.name, fileBase64 };
      setPreview(await invoke(payload, false)); setFile(payload);
    } catch (e) { toast.error(e instanceof Error ? e.message : "Preview failed"); }
    finally { setBusy(false); }
  };
  const apply = async () => {
    if (!file || !canEdit) return;
    setBusy(true);
    try {
      const result = await invoke(file, true);
      toast.success(`Added ${result.newRequirements}; refreshed ${result.refreshedRequirements}; grouped ${result.groupedExistingItems} items; ${result.mastersLinkedToOutline ?? 0} masters linked to outline`);
      await Promise.all([qc.invalidateQueries({ queryKey: ["requirement-items", solicitationId] }), qc.invalidateQueries({ queryKey: ["outline-nodes"] })]);
      setPreview(null); setFile(null);
    } catch (e) { toast.error(e instanceof Error ? e.message : "Import failed"); }
    finally { setBusy(false); }
  };
  if (!canEdit) return null;
  return <>
    <input ref={input} type="file" accept=".xlsx,.xls,.csv" className="hidden" aria-label="Compliance matrix spreadsheet" onChange={e => { void choose(e.target.files?.[0]); e.target.value = ""; }} />
    <Button size="sm" variant="outline" disabled={busy} onClick={() => input.current?.click()}>{busy ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : <FileUp className="mr-1 h-4 w-4" />}Import matrix</Button>
    <Dialog open={!!preview} onOpenChange={open => { if (!open && !busy) { setPreview(null); setFile(null); } }}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader><DialogTitle>Import matrix · {file?.fileName}</DialogTitle><DialogDescription>Each spreadsheet row becomes a master requirement. Existing extracted items are grouped under the matching row; nothing is deleted.</DialogDescription></DialogHeader>
        {preview && <div className="space-y-4 text-sm">
          <p>Sheet: <strong>{preview.sheet}</strong></p>
          <dl className="grid grid-cols-2 gap-x-6 gap-y-2">
            {Object.entries({ "Rows found": preview.rows, "New requirements": preview.newRequirements, "Refreshed requirements": preview.refreshedRequirements, "Existing items to group": preview.groupedExistingItems, "Standalone existing items": preview.standaloneExistingItems, "Need government clarification": preview.needingClarification, "Skipped rows": preview.skipped }).map(([label, value]) => <div key={label} className="flex justify-between gap-2 border-b py-2"><dt>{label}</dt><dd className="font-medium">{value}</dd></div>)}
          </dl>
          <div><h4 className="font-medium mb-1">Counts by status</h4>{Object.entries(preview.byStatus).map(([status, count]) => <p key={status}>{WORKFLOW_LABELS[status] ?? status}: {count}</p>)}</div>
          <div><h4 className="font-medium mb-1">Columns recognized</h4><p className="text-muted-foreground break-words">{preview.columnsFound.join(", ")}</p></div>
        </div>}
        <DialogFooter><Button variant="outline" disabled={busy} onClick={() => { setPreview(null); setFile(null); }}>Cancel</Button><Button disabled={busy} onClick={apply}>{busy && <Loader2 className="mr-1 h-4 w-4 animate-spin" />}Import</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  </>;
}