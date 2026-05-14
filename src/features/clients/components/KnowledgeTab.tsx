import { useEffect, useRef, useState } from "react";
import { format } from "date-fns";
import { BookOpen, FileText, NotebookPen, RefreshCw, Trash2, Upload, AlertCircle, Loader2, CheckCircle2, Pencil } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { toast } from "@/hooks/use-toast";
import {
  useClientKnowledge,
  useCreateKnowledgeNote,
  useUploadKnowledgeFile,
  useReingestKnowledge,
  useDeleteKnowledge,
  useUpdateKnowledgeNote,
  useUpdateKnowledgeMeta,
  type KnowledgeDoc,
} from "../hooks/useClientKnowledge";
import { KNOWLEDGE_TAG_GROUPS } from "../lib/knowledgeTaxonomy";

function StatusPill({ doc }: { doc: KnowledgeDoc }) {
  if (doc.status === "ready")
    return <Badge variant="secondary" className="gap-1"><CheckCircle2 className="h-3 w-3 text-emerald-600" /> Ready · {doc.chunk_count} chunk{doc.chunk_count === 1 ? "" : "s"}</Badge>;
  if (doc.status === "failed")
    return <Badge variant="destructive" className="gap-1"><AlertCircle className="h-3 w-3" /> Failed</Badge>;
  return <Badge variant="outline" className="gap-1"><Loader2 className="h-3 w-3 animate-spin" /> {doc.status === "embedding" ? "Embedding" : "Queued"}</Badge>;
}

export function KnowledgeTab({ clientId }: { clientId: string }) {
  const { data: docs = [], isLoading } = useClientKnowledge(clientId);
  const createNote = useCreateKnowledgeNote(clientId);
  const upload = useUploadKnowledgeFile(clientId);
  const reingest = useReingestKnowledge(clientId);
  const del = useDeleteKnowledge(clientId);
  const updateNote = useUpdateKnowledgeNote(clientId);
  const updateMeta = useUpdateKnowledgeMeta(clientId);
  const fileRef = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(false);
  const [editingDoc, setEditingDoc] = useState<KnowledgeDoc | null>(null);
  const [form, setForm] = useState({ title: "", body: "", tags: "", source_url: "" });

  const isEditing = !!editingDoc;
  const isUploadEdit = isEditing && editingDoc?.source_type === "upload";

  useEffect(() => {
    if (editingDoc) {
      setForm({
        title: editingDoc.title ?? "",
        body: editingDoc.raw_text ?? "",
        tags: (editingDoc.tags ?? []).join(", "),
        source_url: editingDoc.source_url ?? "",
      });
      setOpen(true);
    }
  }, [editingDoc]);

  const resetAndClose = () => {
    setOpen(false);
    setEditingDoc(null);
    setForm({ title: "", body: "", tags: "", source_url: "" });
  };

  const submitNote = async () => {
    if (!form.title.trim()) {
      toast({ title: "Title is required", variant: "destructive" });
      return;
    }
    if (!isUploadEdit && !form.body.trim()) {
      toast({ title: "Content is required", variant: "destructive" });
      return;
    }
    const tags = form.tags.split(",").map((t) => t.trim()).filter(Boolean);
    const source_url = form.source_url.trim() || undefined;
    try {
      if (isEditing && editingDoc) {
        if (isUploadEdit) {
          await updateMeta.mutateAsync({ id: editingDoc.id, title: form.title.trim(), tags, source_url });
          toast({ title: "Updated", description: "Title and tags saved." });
        } else {
          await updateNote.mutateAsync({ id: editingDoc.id, title: form.title.trim(), body: form.body, tags, source_url });
          toast({ title: "Note updated", description: "Re-embedding in the background." });
        }
      } else {
        await createNote.mutateAsync({ title: form.title.trim(), body: form.body, tags, source_url });
        toast({ title: "Note added", description: "Embedding in the background." });
      }
      resetAndClose();
    } catch (e) {
      toast({ title: "Save failed", description: e instanceof Error ? e.message : String(e), variant: "destructive" });
    }
  };

  const onFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      await upload.mutateAsync(file);
      toast({ title: "File uploaded", description: "Embedding in the background." });
    } catch (err) {
      toast({ title: "Upload failed", description: err instanceof Error ? err.message : String(err), variant: "destructive" });
    } finally {
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="flex flex-row items-start justify-between gap-4">
          <div>
            <CardTitle className="flex items-center gap-2 text-base"><BookOpen className="h-4 w-4 text-primary" /> Client Knowledge Library</CardTitle>
            <CardDescription>
              Past proposal notes, lessons learned, and reference text. The AI retrieves the most relevant
              snippets and cites them during every analysis for this client.
            </CardDescription>
          </div>
          <div className="flex gap-2 shrink-0">
            <input
              ref={fileRef}
              type="file"
              accept=".txt,.md,.pdf,.doc,.docx,.xls,.xlsx,text/plain,text/markdown,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
              className="hidden"
              onChange={onFile}
            />
            <Button variant="outline" size="sm" onClick={() => fileRef.current?.click()} disabled={upload.isPending}>
              <Upload className="h-3.5 w-3.5 mr-1" /> Upload file
            </Button>
            <Button size="sm" onClick={() => setOpen(true)}>
              <NotebookPen className="h-3.5 w-3.5 mr-1" /> Add note
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <p className="text-sm text-muted-foreground">Loading…</p>
          ) : docs.length === 0 ? (
            <div className="text-sm text-muted-foreground border border-dashed rounded-md p-6 text-center">
              No knowledge yet. Add a pasted note or upload a PDF, Word, Excel, .txt, or .md file.
            </div>
          ) : (
            <ul className="divide-y">
              {docs.map((d) => (
                <li key={d.id} className="py-3 flex items-start gap-3">
                  <FileText className="h-4 w-4 text-muted-foreground mt-1 shrink-0" />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-medium truncate">{d.title}</span>
                      <Badge variant="outline" className="text-[10px] uppercase">{d.source_type}</Badge>
                      <StatusPill doc={d} />
                      {d.tags?.map((t) => (
                        <Badge key={t} variant="secondary" className="text-[10px]">{t}</Badge>
                      ))}
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      Added {d.created_at ? format(new Date(d.created_at), "PP") : "—"}
                      {d.source_url ? <> · <a href={d.source_url} target="_blank" rel="noreferrer" className="underline">source</a></> : null}
                    </p>
                    {d.status === "failed" && d.error && (
                      <p className="text-xs text-destructive mt-1">{d.error}</p>
                    )}
                  </div>
                  <div className="flex gap-1 shrink-0">
                    <Button size="sm" variant="ghost" onClick={() => setEditingDoc(d)} title="Edit">
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                    <Button size="sm" variant="ghost" disabled={reingest.isPending} onClick={() => reingest.mutate(d.id)} title="Re-embed">
                      <RefreshCw className="h-3.5 w-3.5" />
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => { if (confirm(`Delete "${d.title}"?`)) del.mutate(d); }} title="Delete">
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <Dialog open={open} onOpenChange={(o) => { if (!o) resetAndClose(); else setOpen(true); }}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{isEditing ? (isUploadEdit ? "Edit upload" : "Edit knowledge note") : "Add knowledge note"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label htmlFor="kn-title">Title</Label>
              <Input id="kn-title" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="e.g. 2023 VA T4NG win — past performance language" />
            </div>
            {isUploadEdit ? (
              <p className="text-xs text-muted-foreground italic">Content comes from the uploaded file and can't be edited here. Re-upload the file to replace its content.</p>
            ) : (
              <div>
                <Label htmlFor="kn-body">Content</Label>
                <Textarea id="kn-body" rows={12} value={form.body} onChange={(e) => setForm({ ...form, body: e.target.value })} placeholder="Paste lessons learned, prior proposal sections, themes, etc." />
              </div>
            )}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label htmlFor="kn-tags">Tags (comma separated)</Label>
                <Input id="kn-tags" value={form.tags} onChange={(e) => setForm({ ...form, tags: e.target.value })} placeholder="past-performance, VA, T4NG" />
              </div>
              <div>
                <Label htmlFor="kn-url">Source URL (optional)</Label>
                <Input id="kn-url" value={form.source_url} onChange={(e) => setForm({ ...form, source_url: e.target.value })} placeholder="https://…" />
              </div>
            </div>
            <div className="space-y-2 max-h-48 overflow-y-auto rounded-md border p-2 bg-muted/30">
              <p className="text-xs font-medium text-muted-foreground">Quick-pick tags (federal + utility taxonomy)</p>
              {KNOWLEDGE_TAG_GROUPS.map((g) => (
                <div key={g.label} className="space-y-1">
                  <p className="text-[10px] uppercase tracking-wide text-muted-foreground">{g.label}</p>
                  <div className="flex flex-wrap gap-1">
                    {g.tags.map((t) => {
                      const current = form.tags.split(",").map((x) => x.trim()).filter(Boolean);
                      const active = current.includes(t);
                      return (
                        <button
                          type="button"
                          key={t}
                          onClick={() => {
                            const next = active ? current.filter((x) => x !== t) : [...current, t];
                            setForm({ ...form, tags: next.join(", ") });
                          }}
                          className={`text-[10px] px-2 py-0.5 rounded-full border transition ${active ? "bg-primary text-primary-foreground border-primary" : "bg-background hover:bg-accent"}`}
                        >
                          {t}
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={resetAndClose} disabled={createNote.isPending || updateNote.isPending || updateMeta.isPending}>Cancel</Button>
            <Button onClick={submitNote} disabled={createNote.isPending || updateNote.isPending || updateMeta.isPending}>
              {(createNote.isPending || updateNote.isPending || updateMeta.isPending) ? <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" /> : null}
              {isEditing ? (isUploadEdit ? "Save changes" : "Save & re-embed") : "Save & embed"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
