import { useState, useEffect, useMemo, useCallback } from "react";
import { useActiveOutline, useOutlineNodes } from "@/features/outline/hooks/useProposalOutline";
import { useRequirementItems } from "@/features/deepdive/hooks/useRequirementItems";
import { useWinThemes } from "@/features/winthemes/hooks/useWinThemes";
import {
  useProposalDrafts, useSaveDraft, useAiDraftSection, useAiPolishSection,
} from "../hooks/useProposalDrafts";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Sparkles, Save, FileText, AlertCircle, Loader2, Eye, Pencil } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

interface Props { solicitationId: string }

export function DraftingWorkspace({ solicitationId }: Props) {
  const { data: outline } = useActiveOutline(solicitationId);
  const { data: nodes = [] } = useOutlineNodes(outline?.id);
  const { data: drafts = [] } = useProposalDrafts(solicitationId);
  const { data: requirements = [] } = useRequirementItems(solicitationId);
  const { data: themes = [] } = useWinThemes(solicitationId);

  const draftableNodes = useMemo(() => nodes.filter((n) => n.title), [nodes]);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  useEffect(() => {
    if (!selectedId && draftableNodes.length) setSelectedId(draftableNodes[0].id);
  }, [draftableNodes, selectedId]);

  const draftMap = useMemo(() => new Map(drafts.map((d) => [d.outline_node_id, d])), [drafts]);
  const selectedNode = draftableNodes.find((n) => n.id === selectedId);
  const selectedDraft = selectedId ? draftMap.get(selectedId) : null;

  const [text, setText] = useState("");
  const [dirty, setDirty] = useState(false);
  const [mode, setMode] = useState<"edit" | "preview">("preview");

  useEffect(() => {
    const md = (selectedDraft?.content_json as { markdown?: string } | null)?.markdown ?? selectedDraft?.content_html ?? "";
    setText(md);
    setDirty(false);
  }, [selectedDraft?.id, selectedDraft?.updated_at]);

  const save = useSaveDraft(solicitationId);
  const aiDraft = useAiDraftSection(solicitationId);
  const aiPolish = useAiPolishSection(solicitationId);

  const onSave = useCallback(async () => {
    if (!selectedNode) return;
    try {
      await save.mutateAsync({ outlineNodeId: selectedNode.id, markdown: text });
      setDirty(false);
      toast.success("Draft saved");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Save failed");
    }
  }, [save, selectedNode, text]);

  // Autosave 3s after edits stop
  useEffect(() => {
    if (!dirty) return;
    const t = setTimeout(() => { void onSave(); }, 3000);
    return () => clearTimeout(t);
  }, [text, dirty, onSave]);

  const onAiDraft = async () => {
    if (!selectedNode) return;
    try {
      await aiDraft.mutateAsync(selectedNode.id);
      setMode("preview");
      toast.success("AI draft generated");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "AI draft failed");
    }
  };

  const onPolish = async (action: "tighten" | "expand" | "rewrite_to_theme" | "compliance_check") => {
    if (!selectedDraft) {
      toast.error("Generate or save a draft first");
      return;
    }
    try {
      await aiPolish.mutateAsync({ draftId: selectedDraft.id, action });
      setMode("preview");
      toast.success("Polish applied");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Polish failed");
    }
  };

  const linkedReqs = useMemo(() => {
    if (!selectedNode) return [];
    const ids = new Set(selectedNode.linked_requirement_ids ?? []);
    return requirements.filter((r) => ids.has(r.id));
  }, [selectedNode, requirements]);

  const assignedThemes = useMemo(() => {
    if (!selectedNode) return [];
    return themes.filter((t) => (t.linked_outline_node_ids ?? []).includes(selectedNode.id));
  }, [selectedNode, themes]);

  if (!outline) {
    return (
      <div className="p-6 border rounded-md bg-muted/30 text-sm text-muted-foreground">
        Generate an outline in Phase 3 before drafting.
      </div>
    );
  }

  const totalWords = drafts.reduce((a, d) => a + (d.word_count ?? 0), 0);
  const draftedCount = draftableNodes.filter((n) => draftMap.has(n.id)).length;

  return (
    <div className="grid grid-cols-12 gap-4 h-[calc(100vh-22rem)] min-h-[480px]">
      {/* Left: section tree */}
      <Card className="col-span-3 flex flex-col">
        <div className="p-3 border-b">
          <div className="text-xs text-muted-foreground">Sections</div>
          <div className="text-sm font-medium">{draftedCount}/{draftableNodes.length} drafted · {totalWords.toLocaleString()} words</div>
        </div>
        <ScrollArea className="flex-1">
          <ul className="p-2 space-y-1">
            {draftableNodes.map((n) => {
              const d = draftMap.get(n.id);
              const active = n.id === selectedId;
              return (
                <li key={n.id}>
                  <button
                    onClick={() => setSelectedId(n.id)}
                    className={cn(
                      "w-full text-left px-2 py-1.5 rounded text-xs hover:bg-muted",
                      active && "bg-muted font-medium"
                    )}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="truncate">
                        {n.section_number && <span className="text-muted-foreground mr-1">{n.section_number}</span>}
                        {n.title}
                      </span>
                      {d ? (
                        <Badge variant="outline" className="shrink-0 text-[10px] py-0 px-1">{d.word_count ?? 0}w</Badge>
                      ) : (
                        <span className="text-muted-foreground text-[10px]">—</span>
                      )}
                    </div>
                    {n.volume && <div className="text-[10px] text-muted-foreground mt-0.5">{n.volume}</div>}
                  </button>
                </li>
              );
            })}
          </ul>
        </ScrollArea>
      </Card>

      {/* Center: editor */}
      <Card className="col-span-6 flex flex-col">
        <div className="p-3 border-b flex items-center justify-between gap-2 flex-wrap">
          <div className="min-w-0">
            <div className="text-sm font-semibold truncate">
              {selectedNode ? `${selectedNode.section_number ? selectedNode.section_number + " · " : ""}${selectedNode.title}` : "Select a section"}
            </div>
            <div className="text-xs text-muted-foreground">
              {selectedNode?.volume ?? "—"}
              {selectedNode?.page_allocation ? ` · ${selectedNode.page_allocation} pp allocated` : ""}
              {selectedDraft ? ` · ~${selectedDraft.page_estimate} pp drafted` : ""}
              {dirty ? " · unsaved" : ""}
            </div>
          </div>
          <div className="flex items-center gap-1">
            <div className="inline-flex rounded-md border bg-muted/40 p-0.5 mr-1">
              <button
                type="button"
                onClick={() => setMode("edit")}
                className={cn(
                  "inline-flex items-center gap-1 px-2 py-1 text-xs rounded-sm",
                  mode === "edit" ? "bg-background shadow-sm" : "text-muted-foreground hover:text-foreground"
                )}
                aria-pressed={mode === "edit"}
              >
                <Pencil className="h-3 w-3" /> Edit
              </button>
              <button
                type="button"
                onClick={() => setMode("preview")}
                className={cn(
                  "inline-flex items-center gap-1 px-2 py-1 text-xs rounded-sm",
                  mode === "preview" ? "bg-background shadow-sm" : "text-muted-foreground hover:text-foreground"
                )}
                aria-pressed={mode === "preview"}
              >
                <Eye className="h-3 w-3" /> Preview
              </button>
            </div>
            <Button size="sm" variant="outline" onClick={onSave} disabled={!dirty || save.isPending}>
              {save.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
              <span className="ml-1">Save</span>
            </Button>
            <Button size="sm" onClick={onAiDraft} disabled={!selectedNode || aiDraft.isPending}>
              {aiDraft.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
              <span className="ml-1">AI Draft</span>
            </Button>
          </div>
        </div>
        {mode === "edit" ? (
          <Textarea
            value={text}
            onChange={(e) => { setText(e.target.value); setDirty(true); }}
            className="flex-1 rounded-none border-0 resize-none font-mono text-sm focus-visible:ring-0"
            placeholder="Write the section in Markdown. Cite requirements as [Req-X] and knowledge as [K1]…"
          />
        ) : (
          <div className="flex-1 overflow-auto p-6">
            {text.trim() ? (
              <article className="prose prose-sm dark:prose-invert max-w-none prose-headings:scroll-mt-4">
                <ReactMarkdown remarkPlugins={[remarkGfm]}>{text}</ReactMarkdown>
              </article>
            ) : (
              <div className="text-sm text-muted-foreground">
                No content yet. Click <span className="font-medium">AI Draft</span> to generate, or switch to Edit to write Markdown.
              </div>
            )}
          </div>
        )}
      </Card>

      {/* Right: context */}
      <Card className="col-span-3 flex flex-col">
        <div className="p-3 border-b text-xs font-medium">Context & Polish</div>
        <ScrollArea className="flex-1">
          <div className="p-3 space-y-4">
            <div className="space-y-1.5">
              <div className="text-xs font-semibold">AI polish</div>
              <div className="grid grid-cols-2 gap-1.5">
                <Button size="sm" variant="outline" disabled={!selectedDraft || aiPolish.isPending} onClick={() => onPolish("tighten")}>Tighten</Button>
                <Button size="sm" variant="outline" disabled={!selectedDraft || aiPolish.isPending} onClick={() => onPolish("expand")}>Expand</Button>
                <Button size="sm" variant="outline" disabled={!selectedDraft || aiPolish.isPending} onClick={() => onPolish("rewrite_to_theme")}>Rewrite→Theme</Button>
                <Button size="sm" variant="outline" disabled={!selectedDraft || aiPolish.isPending} onClick={() => onPolish("compliance_check")}>Compliance</Button>
              </div>
              {aiPolish.isPending && <div className="text-xs text-muted-foreground flex items-center gap-1"><Loader2 className="h-3 w-3 animate-spin" />Working…</div>}
            </div>

            <div className="space-y-1.5">
              <div className="text-xs font-semibold flex items-center gap-1.5">
                <FileText className="h-3.5 w-3.5" />
                Requirements ({linkedReqs.length})
              </div>
              {linkedReqs.length === 0 && <div className="text-xs text-muted-foreground">No requirements linked. Link them in Phase 3 outline.</div>}
              <ul className="space-y-1.5">
                {linkedReqs.map((r) => {
                  const cited = text.toLowerCase().includes(`[req-${(r.req_number ?? "").toLowerCase()}]`);
                  return (
                    <li key={r.id} className="text-xs leading-snug border-l-2 pl-2" style={{ borderColor: cited ? "hsl(var(--phase-5))" : "hsl(var(--muted))" }}>
                      <div className="flex items-center justify-between gap-1">
                        <span className="font-mono text-[10px]">[Req-{r.req_number}]</span>
                        {cited ? <Badge variant="outline" className="text-[10px] py-0 px-1">cited</Badge> : <AlertCircle className="h-3 w-3 text-muted-foreground" />}
                      </div>
                      <div className="text-muted-foreground">{r.shall_text?.slice(0, 140)}{(r.shall_text?.length ?? 0) > 140 ? "…" : ""}</div>
                    </li>
                  );
                })}
              </ul>
            </div>

            <div className="space-y-1.5">
              <div className="text-xs font-semibold">Win themes ({assignedThemes.length})</div>
              {assignedThemes.length === 0 && <div className="text-xs text-muted-foreground">No themes assigned to this section.</div>}
              <ul className="space-y-1.5">
                {assignedThemes.map((t) => (
                  <li key={t.id} className="text-xs">
                    <div className="font-medium">{t.title}</div>
                    <div className="text-muted-foreground">{t.theme_statement}</div>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </ScrollArea>
      </Card>
    </div>
  );
}
