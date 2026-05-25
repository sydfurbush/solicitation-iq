import { useEffect, useState } from "react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
  SheetFooter,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { Upload, Loader2, Download } from "lucide-react";
import {
  useCreateExhibit,
  useUpdateExhibit,
  useUploadExhibitFile,
  getExhibitSignedUrl,
  type Exhibit,
  type ExhibitKind,
  type ExhibitPlacement,
  type ExhibitStatus,
} from "../hooks/useExhibits";

type OutlineNodeLite = { id: string; title: string | null; section_number: string | null; volume: string | null };

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  solicitationId: string;
  organizationId: string;
  exhibit?: Exhibit | null;
  defaultOutlineNodeId?: string | null;
  outlineNodes: OutlineNodeLite[];
}

const KINDS: ExhibitKind[] = [
  "figure",
  "table",
  "chart",
  "exhibit",
  "resume",
  "past_performance",
  "certification",
  "appendix",
  "other",
];
const PLACEMENTS: ExhibitPlacement[] = ["inline", "end_of_section", "appendix"];
const STATUSES: ExhibitStatus[] = ["placeholder", "in_progress", "ready", "approved"];

const UNASSIGNED = "__unassigned__";

export function ExhibitDrawer({
  open,
  onOpenChange,
  solicitationId,
  organizationId,
  exhibit,
  defaultOutlineNodeId,
  outlineNodes,
}: Props) {
  const create = useCreateExhibit(solicitationId, organizationId);
  const update = useUpdateExhibit(solicitationId);
  const upload = useUploadExhibitFile(solicitationId);

  const [form, setForm] = useState({
    kind: "figure" as ExhibitKind,
    title: "",
    label: "",
    caption: "",
    description: "",
    outline_node_id: defaultOutlineNodeId ?? "",
    appendix_code: "",
    placement: "inline" as ExhibitPlacement,
    status: "placeholder" as ExhibitStatus,
    due_date: "",
    notes: "",
  });
  const [file, setFile] = useState<File | null>(null);

  useEffect(() => {
    if (!open) return;
    if (exhibit) {
      setForm({
        kind: exhibit.kind,
        title: exhibit.title,
        label: exhibit.label ?? "",
        caption: exhibit.caption ?? "",
        description: exhibit.description ?? "",
        outline_node_id: exhibit.outline_node_id ?? "",
        appendix_code: exhibit.appendix_code ?? "",
        placement: exhibit.placement,
        status: exhibit.status,
        due_date: exhibit.due_date ?? "",
        notes: exhibit.notes ?? "",
      });
    } else {
      setForm((f) => ({
        ...f,
        kind: "figure",
        title: "",
        label: "",
        caption: "",
        description: "",
        outline_node_id: defaultOutlineNodeId ?? "",
        appendix_code: "",
        placement: "inline",
        status: "placeholder",
        due_date: "",
        notes: "",
      }));
    }
    setFile(null);
  }, [open, exhibit, defaultOutlineNodeId]);

  const onSave = async () => {
    if (!form.title.trim()) {
      toast.error("Title is required");
      return;
    }
    const payload = {
      kind: form.kind,
      title: form.title.trim(),
      label: form.label.trim() || null,
      caption: form.caption.trim() || null,
      description: form.description.trim() || null,
      outline_node_id:
        form.placement === "appendix" ? null : form.outline_node_id || null,
      appendix_code:
        form.placement === "appendix" ? form.appendix_code.trim() || null : null,
      placement: form.placement,
      status: form.status,
      due_date: form.due_date || null,
      notes: form.notes.trim() || null,
    };
    try {
      let saved: Exhibit;
      if (exhibit) {
        saved = await update.mutateAsync({ id: exhibit.id, patch: payload });
      } else {
        saved = await create.mutateAsync(payload);
      }
      if (file) {
        await upload.mutateAsync({ exhibit: saved, file });
      }
      toast.success(exhibit ? "Exhibit updated" : "Exhibit added");
      onOpenChange(false);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Save failed");
    }
  };

  const downloadCurrentFile = async () => {
    if (!exhibit?.file_path) return;
    try {
      const url = await getExhibitSignedUrl(exhibit.file_path, 60);
      window.open(url, "_blank");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Download failed");
    }
  };

  const pending = create.isPending || update.isPending || upload.isPending;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-lg overflow-y-auto">
        <SheetHeader>
          <SheetTitle>{exhibit ? "Edit exhibit" : "Add exhibit"}</SheetTitle>
          <SheetDescription>
            Register a figure, table, chart, resume, past-performance write-up, certification, or appendix file.
          </SheetDescription>
        </SheetHeader>

        <div className="space-y-4 py-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs">Kind</Label>
              <Select value={form.kind} onValueChange={(v) => setForm({ ...form, kind: v as ExhibitKind })}>
                <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {KINDS.map((k) => (
                    <SelectItem key={k} value={k} className="capitalize">{k.replace(/_/g, " ")}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Status</Label>
              <Select value={form.status} onValueChange={(v) => setForm({ ...form, status: v as ExhibitStatus })}>
                <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {STATUSES.map((s) => (
                    <SelectItem key={s} value={s} className="capitalize">{s.replace(/_/g, " ")}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs">Title *</Label>
            <Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="System Architecture Overview" />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs">Label (optional)</Label>
              <Input value={form.label} onChange={(e) => setForm({ ...form, label: e.target.value })} placeholder="Figure 3-1" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Due date</Label>
              <Input type="date" value={form.due_date} onChange={(e) => setForm({ ...form, due_date: e.target.value })} />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs">Placement</Label>
            <Select value={form.placement} onValueChange={(v) => setForm({ ...form, placement: v as ExhibitPlacement })}>
              <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
              <SelectContent>
                {PLACEMENTS.map((p) => (
                  <SelectItem key={p} value={p} className="capitalize">{p.replace(/_/g, " ")}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-[11px] text-muted-foreground">
              Inline: inserted at <code>{"{{exhibit:id}}"}</code> token. End of section: appended after section body. Appendix: grouped into the appendix volume.
            </p>
          </div>

          {form.placement === "appendix" ? (
            <div className="space-y-1.5">
              <Label className="text-xs">Appendix code</Label>
              <Input value={form.appendix_code} onChange={(e) => setForm({ ...form, appendix_code: e.target.value })} placeholder="Appendix B" />
            </div>
          ) : (
            <div className="space-y-1.5">
              <Label className="text-xs">Assign to outline section</Label>
              <Select
                value={form.outline_node_id || UNASSIGNED}
                onValueChange={(v) => setForm({ ...form, outline_node_id: v === UNASSIGNED ? "" : v })}
              >
                <SelectTrigger className="h-9"><SelectValue placeholder="Unassigned" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value={UNASSIGNED}>Unassigned</SelectItem>
                  {outlineNodes.map((n) => (
                    <SelectItem key={n.id} value={n.id}>
                      {n.section_number ? `${n.section_number} · ` : ""}{n.title ?? "Untitled"}
                      {n.volume ? ` (${n.volume})` : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          <div className="space-y-1.5">
            <Label className="text-xs">Caption</Label>
            <Input value={form.caption} onChange={(e) => setForm({ ...form, caption: e.target.value })} placeholder="Caption shown beneath the exhibit in the compiled document" />
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs">Description / notes</Label>
            <Textarea rows={3} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="What this exhibit shows, who owns it, what data is needed..." />
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs">File {exhibit?.file_name ? <span className="text-muted-foreground font-normal">· current: {exhibit.file_name}</span> : null}</Label>
            <div className="flex items-center gap-2">
              <Input
                type="file"
                accept="image/png,image/jpeg,image/svg+xml,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.openxmlformats-officedocument.presentationml.presentation"
                onChange={(e) => setFile(e.target.files?.[0] ?? null)}
              />
              {exhibit?.file_path && (
                <Button type="button" size="sm" variant="outline" onClick={downloadCurrentFile}>
                  <Download className="h-3.5 w-3.5 mr-1" /> Current
                </Button>
              )}
            </div>
            <p className="text-[11px] text-muted-foreground">PNG, JPG, SVG, PDF, DOCX, XLSX, PPTX. Optional — leave blank to register as a placeholder.</p>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs">Internal notes</Label>
            <Textarea rows={2} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
          </div>
        </div>

        <SheetFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={pending}>Cancel</Button>
          <Button onClick={onSave} disabled={pending}>
            {pending && <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />}
            {!pending && <Upload className="h-4 w-4 mr-1.5" />}
            {exhibit ? "Save changes" : "Add exhibit"}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
