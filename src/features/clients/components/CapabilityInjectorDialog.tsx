import { useMemo, useRef, useState } from "react";
import { FileText, Loader2, Sparkles, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useUpdateClient } from "@/features/clients/hooks/useClients";
import { useExtractCapabilities, type CapabilityExtraction, type ExtractedCapabilities } from "@/features/clients/hooks/useExtractCapabilities";
import { toast } from "@/hooks/use-toast";
import type { Database } from "@/integrations/supabase/types";

type ClientRow = Database["public"]["Tables"]["clients"]["Row"];

type Capabilities = ExtractedCapabilities;

const FIELD_LABELS: { key: keyof Capabilities; label: string; kind: "text" | "chips" }[] = [
  { key: "core_capabilities", label: "Core capabilities", kind: "text" },
  { key: "differentiators", label: "Differentiators", kind: "text" },
  { key: "past_performance", label: "Past performance", kind: "text" },
  { key: "key_personnel", label: "Key personnel", kind: "text" },
  { key: "teaming_partners", label: "Teaming partners", kind: "text" },
  { key: "notes", label: "Notes", kind: "text" },
  { key: "naics_codes", label: "NAICS codes", kind: "chips" },
  { key: "certifications", label: "Certifications & set-asides", kind: "chips" },
];

const MAX_FILE_MB = 15;

function parseCurrent(metadata: ClientRow["metadata"]): Capabilities {
  const caps = (metadata as Record<string, unknown> | null)?.capabilities;
  if (!caps || typeof caps !== "object") return {};
  return caps as Capabilities;
}

function isEmpty(v: unknown): boolean {
  if (v == null) return true;
  if (typeof v === "string") return !v.trim();
  if (Array.isArray(v)) return v.length === 0;
  return false;
}

function mergeChips(a: string[] | undefined, b: string[] | undefined): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  for (const v of [...(a ?? []), ...(b ?? [])]) {
    const t = v.trim();
    if (!t || seen.has(t.toLowerCase())) continue;
    seen.add(t.toLowerCase());
    out.push(t);
  }
  return out;
}

export function CapabilityInjectorDialog({
  open,
  onOpenChange,
  client,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  client: ClientRow;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [tab, setTab] = useState<"upload" | "paste">("upload");
  const [file, setFile] = useState<File | null>(null);
  const [pasted, setPasted] = useState("");
  const [draft, setDraft] = useState<CapabilityExtraction | null>(null);
  const [selected, setSelected] = useState<Record<string, boolean>>({});
  const [mergeMode, setMergeMode] = useState<Record<string, "replace" | "merge">>({});

  const extract = useExtractCapabilities();
  const updateClient = useUpdateClient();

  const current = useMemo(() => parseCurrent(client.metadata), [client.metadata]);

  const reset = () => {
    setFile(null);
    setPasted("");
    setDraft(null);
    setSelected({});
    setMergeMode({});
    if (fileRef.current) fileRef.current.value = "";
  };

  const handleClose = (v: boolean) => {
    if (!v) reset();
    onOpenChange(v);
  };

  const runExtract = async () => {
    try {
      const r = await extract.mutateAsync({
        clientId: client.id,
        file: tab === "upload" ? file ?? undefined : undefined,
        text: tab === "paste" ? pasted : undefined,
      });
      setDraft(r.draft);
      // Pre-select fields that are currently empty.
      const initial: Record<string, boolean> = {};
      const initialMode: Record<string, "replace" | "merge"> = {};
      for (const f of FIELD_LABELS) {
        const suggested = r.draft.capabilities[f.key];
        if (isEmpty(suggested)) continue;
        const currentVal = current[f.key];
        initial[f.key] = isEmpty(currentVal);
        initialMode[f.key] = f.kind === "chips" ? "merge" : isEmpty(currentVal) ? "replace" : "merge";
      }
      setSelected(initial);
      setMergeMode(initialMode);
      if (r.meta.truncated) {
        toast({ title: "Document truncated", description: "Only the first 60k characters were analyzed." });
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      toast({ title: "Extraction failed", description: msg, variant: "destructive" });
    }
  };

  const apply = async () => {
    if (!draft) return;
    const next: Capabilities = { ...current };
    let updates = 0;
    for (const f of FIELD_LABELS) {
      if (!selected[f.key]) continue;
      const suggested = draft.capabilities[f.key];
      if (isEmpty(suggested)) continue;
      if (f.kind === "chips") {
        const cur = (current[f.key] as string[] | undefined) ?? [];
        const sug = (suggested as string[]) ?? [];
        next[f.key] = (mergeMode[f.key] === "replace" ? sug : mergeChips(cur, sug)) as never;
      } else {
        const cur = (current[f.key] as string | undefined) ?? "";
        const sug = String(suggested);
        if (mergeMode[f.key] === "replace" || !cur.trim()) {
          next[f.key] = sug as never;
        } else {
          next[f.key] = `${cur.trim()}\n\n${sug}` as never;
        }
      }
      updates += 1;
    }
    if (updates === 0) {
      toast({ title: "No fields selected" });
      return;
    }
    try {
      const meta = (client.metadata as Record<string, unknown> | null) ?? {};
      await updateClient.mutateAsync({
        id: client.id,
        input: { metadata: { ...meta, capabilities: next } } as never,
      });
      toast({ title: `Updated ${updates} field${updates === 1 ? "" : "s"}` });
      reset();
      onOpenChange(false);
    } catch (e) {
      toast({ title: "Save failed", description: e instanceof Error ? e.message : String(e), variant: "destructive" });
    }
  };

  const onPickFile = (f: File | null) => {
    if (!f) {
      setFile(null);
      return;
    }
    if (f.size > MAX_FILE_MB * 1024 * 1024) {
      toast({ title: "File too large", description: `Max ${MAX_FILE_MB} MB`, variant: "destructive" });
      return;
    }
    setFile(f);
  };

  const canRun =
    !extract.isPending &&
    ((tab === "upload" && !!file) || (tab === "paste" && pasted.trim().length > 40));

  const selectedCount = Object.values(selected).filter(Boolean).length;

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-3xl max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>Inject capabilities from document</DialogTitle>
          <DialogDescription>
            Upload a capability statement or paste its contents. AI will extract structured fields you can review before applying.
          </DialogDescription>
        </DialogHeader>

        {!draft ? (
          <div className="flex-1 overflow-auto space-y-4">
            <Tabs value={tab} onValueChange={(v) => setTab(v as "upload" | "paste")}>
              <TabsList>
                <TabsTrigger value="upload"><Upload className="h-3.5 w-3.5 mr-1" /> Upload file</TabsTrigger>
                <TabsTrigger value="paste"><FileText className="h-3.5 w-3.5 mr-1" /> Paste text</TabsTrigger>
              </TabsList>
              <TabsContent value="upload" className="mt-4">
                <div
                  className="border-2 border-dashed rounded-lg p-8 text-center hover:bg-muted/40 transition-colors cursor-pointer"
                  onClick={() => fileRef.current?.click()}
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={(e) => {
                    e.preventDefault();
                    const f = e.dataTransfer.files?.[0];
                    if (f) onPickFile(f);
                  }}
                >
                  <Upload className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
                  {file ? (
                    <p className="text-sm font-medium">{file.name} <span className="text-muted-foreground">({(file.size / 1024).toFixed(0)} KB)</span></p>
                  ) : (
                    <>
                      <p className="text-sm font-medium">Click to choose a file or drag & drop</p>
                      <p className="text-xs text-muted-foreground mt-1">PDF, Word (.docx), .txt or .md · max {MAX_FILE_MB} MB</p>
                    </>
                  )}
                  <input
                    ref={fileRef}
                    type="file"
                    className="hidden"
                    accept=".pdf,.docx,.doc,.txt,.md,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/plain,text/markdown"
                    onChange={(e) => onPickFile(e.target.files?.[0] ?? null)}
                  />
                </div>
              </TabsContent>
              <TabsContent value="paste" className="mt-4">
                <Textarea
                  rows={12}
                  placeholder="Paste the full text of the capability statement here…"
                  value={pasted}
                  onChange={(e) => setPasted(e.target.value)}
                />
                <p className="text-xs text-muted-foreground mt-1">{pasted.length.toLocaleString()} characters</p>
              </TabsContent>
            </Tabs>
          </div>
        ) : (
          <ScrollArea className="flex-1 pr-3">
            <div className="space-y-3">
              <p className="text-xs text-muted-foreground">
                Review each suggested field. Tick the ones you want to apply, then choose merge or replace. Nothing is saved until you click Apply.
              </p>
              {FIELD_LABELS.map((f) => {
                const suggested = draft.capabilities[f.key];
                if (isEmpty(suggested)) return null;
                const currentVal = current[f.key];
                const excerpt = draft.source_excerpts?.[f.key];
                const conf = draft.confidence?.[f.key];
                const checked = !!selected[f.key];
                const mode = mergeMode[f.key] ?? "merge";

                return (
                  <div key={f.key} className="border rounded-md p-3 space-y-2">
                    <div className="flex items-start gap-3">
                      <Checkbox
                        checked={checked}
                        onCheckedChange={(v) => setSelected((s) => ({ ...s, [f.key]: v === true }))}
                        className="mt-1"
                      />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-sm font-medium">{f.label}</span>
                          {typeof conf === "number" && (
                            <Badge variant="outline" className="text-[10px]">
                              {Math.round(conf * 100)}% confidence
                            </Badge>
                          )}
                          {!isEmpty(currentVal) && (
                            <div className="ml-auto flex items-center gap-1 text-xs">
                              <button
                                type="button"
                                className={`px-2 py-0.5 rounded ${mode === "merge" ? "bg-primary text-primary-foreground" : "border"}`}
                                onClick={() => setMergeMode((m) => ({ ...m, [f.key]: "merge" }))}
                              >Merge</button>
                              <button
                                type="button"
                                className={`px-2 py-0.5 rounded ${mode === "replace" ? "bg-primary text-primary-foreground" : "border"}`}
                                onClick={() => setMergeMode((m) => ({ ...m, [f.key]: "replace" }))}
                              >Replace</button>
                            </div>
                          )}
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-2 mt-2">
                          <div>
                            <p className="text-[10px] uppercase tracking-wide text-muted-foreground mb-1">Current</p>
                            {f.kind === "chips" ? (
                              <div className="flex flex-wrap gap-1 min-h-[1.5rem]">
                                {((currentVal as string[] | undefined) ?? []).map((v) => (
                                  <Badge key={v} variant="secondary" className="text-[10px]">{v}</Badge>
                                ))}
                                {isEmpty(currentVal) && <span className="text-xs text-muted-foreground italic">empty</span>}
                              </div>
                            ) : (
                              <p className="text-xs whitespace-pre-wrap text-muted-foreground">
                                {(currentVal as string | undefined) || <span className="italic">empty</span>}
                              </p>
                            )}
                          </div>
                          <div>
                            <p className="text-[10px] uppercase tracking-wide text-muted-foreground mb-1">Suggested</p>
                            {f.kind === "chips" ? (
                              <div className="flex flex-wrap gap-1">
                                {((suggested as string[]) ?? []).map((v) => (
                                  <Badge key={v} className="text-[10px]">{v}</Badge>
                                ))}
                              </div>
                            ) : (
                              <p className="text-xs whitespace-pre-wrap">{String(suggested)}</p>
                            )}
                          </div>
                        </div>
                        {excerpt && (
                          <p className="text-[11px] text-muted-foreground mt-2 border-l-2 pl-2 italic">
                            "{excerpt}"
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}

              {draft.profile_hints && Object.values(draft.profile_hints).some((v) => Array.isArray(v) && v.length > 0) && (
                <div className="border rounded-md p-3 bg-muted/30">
                  <p className="text-xs font-medium mb-2">Additional signals (not applied — informational only)</p>
                  <div className="space-y-1 text-xs">
                    {(["agencies_focus", "contract_vehicles", "compliance_frameworks", "psc_codes", "service_categories"] as const).map((k) => {
                      const arr = draft.profile_hints?.[k];
                      if (!arr?.length) return null;
                      return (
                        <div key={k} className="flex gap-2 flex-wrap">
                          <span className="capitalize text-muted-foreground">{k.replace(/_/g, " ")}:</span>
                          {arr.map((v) => <Badge key={v} variant="outline" className="text-[10px]">{v}</Badge>)}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          </ScrollArea>
        )}

        <DialogFooter className="gap-2">
          {!draft ? (
            <>
              <Button variant="ghost" onClick={() => handleClose(false)}>Cancel</Button>
              <Button onClick={runExtract} disabled={!canRun}>
                {extract.isPending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Sparkles className="h-4 w-4 mr-2" />}
                Extract capabilities
              </Button>
            </>
          ) : (
            <>
              <Button variant="ghost" onClick={() => { setDraft(null); setSelected({}); }}>
                Back
              </Button>
              <Button onClick={apply} disabled={selectedCount === 0 || updateClient.isPending}>
                {updateClient.isPending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
                Apply {selectedCount > 0 ? `${selectedCount} field${selectedCount === 1 ? "" : "s"}` : ""}
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
