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
import { ToastAction } from "@/components/ui/toast";
import { useQueryClient } from "@tanstack/react-query";
import { useSearchParams } from "react-router-dom";
import { useUser } from "@/features/auth/hooks/useUser";
import { recheckKnowledgeDocument, useOnboardingDocuments, useOnboardingTriage } from "@/features/onboarding/hooks/useOnboarding";
import { effectiveDestinations } from "@/features/onboarding/lib/onboardingFiles";
import { DestinationBadge } from "@/features/onboarding/components/DestinationBadge";
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
    return <Badge variant="secondary" className="gap-1"><CheckCircle2 className="h-3 w-3 text-accent" /> Ready · {doc.chunk_count} chunk{doc.chunk_count === 1 ? "" : "s"}</Badge>;
  if (doc.status === "failed")
    return <Badge variant="destructive" className="gap-1"><AlertCircle className="h-3 w-3" /> Failed</Badge>;
  return <Badge variant="outline" className="gap-1"><Loader2 className="h-3 w-3 animate-spin" /> {doc.status === "embedding" ? "Embedding" : "Queued"}</Badge>;
}

export function KnowledgeTab({ clientId }: { clientId: string }) {
  const qc = useQueryClient();
  const { role } = useUser();
  const canRecheck = role === "owner" || role === "admin" || role === "analyst";
  const [, setSearchParams] = useSearchParams();
  const { data: onboarding = [], isLoading: onboardingLoading } = useOnboardingDocuments(clientId);
  const { data: triage = [] } = useOnboardingTriage(clientId);
  const [checkingId, setCheckingId] = useState<string | null>(null);
  const [progress, setProgress] = useState<{ current: number; total: number } | null>(null);
  const checkingRef = useRef(false);
  const { data: docs = [], isLoading } = useClientKnowledge(clientId);
  const unchecked = onboardingLoading ? [] : docs.filter((d) => d.source_type === "upload" && !onboarding.some((o) => o.knowledge_document_id === d.id));
  const viewOnboarding = (documentId: string) => setSearchParams({ tab: "onboarding", onboardingDocument: documentId }, { replace: true });
  const recheck = async (id: string) => {
    setCheckingId(id);
    try {
      const documentId = await recheckKnowledgeDocument(id);
      toast({ title: "Triage finished", action: documentId ? <ToastAction altText="View in Onboarding" onClick={() => viewOnboarding(documentId)}>View in Onboarding</ToastAction> : undefined });
      return true;
    } catch (e) {
      toast({ title: "Re-check failed", description: e instanceof Error ? e.message : String(e), variant: "destructive" });
      return false;
    } finally {
      setCheckingId(null);
      await Promise.all([
        qc.invalidateQueries({ queryKey: ["onboarding-docs", clientId] }),
        qc.invalidateQueries({ queryKey: ["onboarding-triage", clientId] }),
      ]);
    }
  };
  const recheckOne = async (id: string) => {
    if (checkingRef.current) return;
    checkingRef.current = true;
    try { await recheck(id); } finally { checkingRef.current = false; }
  };
  const recheckAll = async () => {
    if (checkingRef.current) return;
    checkingRef.current = true;
    const batch = [...unchecked];
    let failed = 0;
    try {
      for (let i = 0; i < batch.length; i++) {
        setProgress({ current: i + 1, total: batch.length });
        if (!await recheck(batch[i].id)) failed++;
      }
      toast({ title: "Re-checks finished", description: `${batch.length - failed} checked${failed ? `; ${failed} failed` : ""}.` });
    } finally { setProgress(null); checkingRef.current = false; }
  };
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
      {(unchecked.length > 0 || progress) && (
        <div className="flex flex-wrap items-center justify-between gap-3 border-l-4 border-warning bg-warning/10 p-4">
          <p className="text-sm flex-1 min-w-0">{unchecked.length} files were added before document triage and haven't been checked for pricing, personal data or partner content.</p>
          {canRecheck && <Button size="sm" variant="outline" disabled={!!checkingId || !!progress} onClick={recheckAll}>
            {progress ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Checking {progress.current} of {progress.total}…</> : "Re-check all"}
          </Button>}
        </div>
      )}
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
              {docs.map((d) => {
                const onboardingDoc = onboarding.find((o) => o.knowledge_document_id === d.id);
                const outcome = onboardingDoc ? triage.find((t) => t.document_id === onboardingDoc.id) : undefined;
                return (
                <li key={d.id} className="py-3 flex flex-wrap items-start gap-3">
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
                    {outcome && <div className="flex flex-wrap gap-1 mt-2">
                      {effectiveDestinations(outcome).map((destination) => <DestinationBadge key={destination} destination={destination} />)}
                      {outcome.requires_cleaning && <Badge variant="outline" className="border-destructive/50 text-destructive">Needs cleaning</Badge>}
                    </div>}
                    {onboardingDoc && <Button variant="link" size="sm" className="h-auto p-0 mt-2" onClick={() => viewOnboarding(onboardingDoc.id)}>View in Onboarding</Button>}
                  </div>
                  <div className="flex flex-wrap gap-1 shrink-0">
                    {d.source_type === "upload" && canRecheck && <Button size="sm" variant="outline" disabled={!!checkingId || !!progress || onboardingDoc?.status === "processing"} onClick={() => recheckOne(d.id)}>
                      {checkingId === d.id ? <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5 mr-1" />}Re-check with triage
                    </Button>}
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
              ); })}
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
