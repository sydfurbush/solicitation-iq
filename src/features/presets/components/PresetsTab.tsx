import { useMemo, useState } from "react";
import { z } from "zod";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Plus, Pencil, Copy, Trash2, History, Sparkles, RotateCcw, ChevronDown, Info } from "lucide-react";
import {
  usePresets,
  useCreatePreset,
  useSavePresetVersion,
  useClonePreset,
  useDeletePreset,
  usePresetVersions,
  usePresetCurrentContent,
  useRollbackPreset,
  type PresetRow,
  type PresetContent,
} from "../hooks/usePresets";
import type { GeneratedPresetDraft, PresetReasoning } from "../hooks/useGeneratePreset";
import { AIGenerateDialog } from "./AIGenerateDialog";
import { ConfirmDialog } from "@/components/shared/ConfirmDialog";
import { toast } from "sonner";

const keyRegex = /^[a-z0-9_]+$/;
const presetSchema = z.object({
  key: z
    .string()
    .min(2, "Key must be at least 2 characters")
    .max(64, "Key must be 64 characters or fewer")
    .regex(keyRegex, "Key may only contain lowercase letters, digits, and underscores"),
  label: z.string().min(2, "Label must be at least 2 characters").max(120, "Label must be 120 characters or fewer"),
  description: z.string().max(500, "Description must be 500 characters or fewer").optional(),
  family: z.enum(["federal", "utility"]),
});

function TagEditor({ label, values, onChange, placeholder }: {
  label: React.ReactNode; values: string[]; onChange: (v: string[]) => void; placeholder?: string;
}) {
  const [draft, setDraft] = useState("");
  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      <div className="flex flex-wrap gap-1.5">
        {values.map((v, i) => (
          <Badge key={`${v}-${i}`} variant="secondary" className="gap-1.5">
            {v}
            <button type="button" onClick={() => onChange(values.filter((_, idx) => idx !== i))} className="hover:text-destructive">
              <Trash2 className="h-3 w-3" />
            </button>
          </Badge>
        ))}
      </div>
      <div className="flex gap-2">
        <Input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && draft.trim()) {
              e.preventDefault();
              onChange([...values, draft.trim()]);
              setDraft("");
            }
          }}
          placeholder={placeholder ?? "Add and press Enter"}
        />
        <Button type="button" variant="outline" size="icon" onClick={() => { if (draft.trim()) { onChange([...values, draft.trim()]); setDraft(""); } }}>
          <Plus className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}

export function PresetsTab() {
  const { data: presets = [], isLoading } = usePresets();
  const [editing, setEditing] = useState<PresetRow | null>(null);
  const [creating, setCreating] = useState(false);
  const [historyFor, setHistoryFor] = useState<PresetRow | null>(null);
  const [aiOpen, setAiOpen] = useState(false);
  const [aiDraft, setAiDraft] = useState<GeneratedPresetDraft | null>(null);

  const builtins = presets.filter((p) => p.is_builtin);
  const customs = presets.filter((p) => !p.is_builtin);

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
          <CardTitle className="text-base flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-primary" /> Service Presets
          </CardTitle>
          <p className="text-sm text-muted-foreground mt-1">Reusable AI Lens starters: NAICS, agencies, vehicles, compliance, and keywords.</p>
        </div>
        <Button onClick={() => setCreating(true)}><Plus className="h-4 w-4 mr-2" />New preset</Button>
      </CardHeader>
        <Button onClick={() => setCreating(true)} className="rounded-r-none"><Plus className="h-4 w-4 mr-2" />New preset</Button>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button className="rounded-l-none border-l border-primary-foreground/20 px-2" aria-label="More create options">
              <ChevronDown className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={() => { setAiDraft(null); setCreating(true); }}>
              <Plus className="h-4 w-4 mr-2" /> Blank preset
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => setAiOpen(true)}>
              <Sparkles className="h-4 w-4 mr-2" /> Generate with AI
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </CardHeader>
      <CardContent className="space-y-6">
        {isLoading && <p className="text-sm text-muted-foreground">Loading…</p>}

        <section className="space-y-2">
          <h3 className="text-sm font-medium">Your custom presets ({customs.length})</h3>
          {customs.length === 0 && <p className="text-xs text-muted-foreground">None yet. Create one or clone a built-in.</p>}
          <div className="grid gap-2">
            {customs.map((p) => (
              <PresetRowItem key={p.id} preset={p} onEdit={() => setEditing(p)} onHistory={() => setHistoryFor(p)} />
            ))}
          </div>
        </section>

        <section className="space-y-2">
          <h3 className="text-sm font-medium">Built-in presets ({builtins.length})</h3>
          <div className="grid gap-2">
            {builtins.map((p) => (
              <PresetRowItem key={p.id} preset={p} onEdit={() => setEditing(p)} onHistory={() => setHistoryFor(p)} />
            ))}
          </div>
        </section>
      </CardContent>

      {aiOpen && (
        <AIGenerateDialog
          open
          onClose={() => setAiOpen(false)}
          onGenerated={(draft) => { setAiDraft(draft); setAiOpen(false); setCreating(true); }}
        />
      )}
      {creating && <CreateDialog open onClose={() => { setCreating(false); setAiDraft(null); }} initialDraft={aiDraft} />}
      {editing && <EditDialog preset={editing} open onClose={() => setEditing(null)} />}
      {historyFor && <HistoryDialog preset={historyFor} open onClose={() => setHistoryFor(null)} />}
    </Card>
  );
}

function PresetRowItem({ preset, onEdit, onHistory }: { preset: PresetRow; onEdit: () => void; onHistory: () => void }) {
  const clone = useClonePreset();
  const del = useDeletePreset();
  const { data: current } = usePresetCurrentContent(preset);
  const [confirmDel, setConfirmDel] = useState(false);

  const doClone = () => {
    if (!current) { toast.error("Loading preset content…"); return; }
    const newKey = window.prompt("New key (lowercase, underscores)?", `${preset.key}_copy`);
    if (!newKey) return;
    if (!keyRegex.test(newKey)) { toast.error("Invalid key"); return; }
    const newLabel = window.prompt("New label?", `${preset.label} (copy)`) ?? `${preset.label} (copy)`;
    clone.mutate({ source: preset, sourceContent: current.content, newKey, newLabel });
  };

  return (
    <div className="flex items-center justify-between rounded border p-3">
      <div className="min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="font-medium truncate">{preset.label}</span>
          <Badge variant="outline" className="text-xs">{preset.family}</Badge>
          {preset.is_builtin && <Badge variant="secondary" className="text-xs">built-in</Badge>}
          {current && <Badge variant="outline" className="text-xs">v{current.version}</Badge>}
        </div>
        {preset.description && <p className="text-xs text-muted-foreground mt-1 truncate">{preset.description}</p>}
      </div>
      <div className="flex items-center gap-1 shrink-0">
        <Button variant="ghost" size="sm" onClick={onHistory}><History className="h-4 w-4" /></Button>
        <Button variant="ghost" size="sm" onClick={doClone}><Copy className="h-4 w-4" /></Button>
        <Button variant="ghost" size="sm" onClick={onEdit} disabled={preset.is_builtin}>
          <Pencil className="h-4 w-4" />
        </Button>
        {!preset.is_builtin && (
          <Button variant="ghost" size="sm" onClick={() => setConfirmDel(true)}>
            <Trash2 className="h-4 w-4 text-destructive" />
          </Button>
        )}
      </div>
      {confirmDel && (
        <ConfirmDialog
          open
          onOpenChange={(v) => !v && setConfirmDel(false)}
          title={`Delete "${preset.label}"?`}
          description="Existing client lenses keyed to this preset will keep their current values; the preset just won't be selectable anymore."
          confirmText="Delete"
          variant="danger"
          onConfirm={() => del.mutate(preset.id)}
        />
      )}
    </div>
  );
}

function slugify(s: string): string {
  return s.toLowerCase().trim().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "").slice(0, 60) || "preset";
}

function CreateDialog({ open, onClose, initialDraft }: { open: boolean; onClose: () => void; initialDraft?: GeneratedPresetDraft | null }) {
  const create = useCreatePreset();
  const empty: PresetContent = useMemo(() => ({
    naics_codes: [], psc_codes: [], set_asides: [], agencies_focus: [],
    contract_vehicles: [], compliance_frameworks: [], discriminators: [],
    acronym_glossary: {}, always_flag: [], tone_voice: "consultative", reading_level: 12, keywords: [],
  }), []);
  const [key, setKey] = useState(() => initialDraft ? slugify(initialDraft.label) : "");
  const [keyTouched, setKeyTouched] = useState(!!initialDraft);
  const [label, setLabel] = useState(initialDraft?.label ?? "");
  const [description, setDescription] = useState(initialDraft?.description ?? "");
  const [family, setFamily] = useState<"federal" | "utility">(initialDraft?.family ?? "federal");
  const [content, setContent] = useState<PresetContent>(initialDraft?.content ?? empty);
  const reasoning = initialDraft?.reasoning;

  const handleLabel = (v: string) => {
    setLabel(v);
    if (!keyTouched) setKey(slugify(v));
  };
  const handleKey = (v: string) => {
    setKeyTouched(true);
    setKey(v);
  };

  const submit = () => {
    const trimmedLabel = label.trim();
    const trimmedKey = key.trim();
    if (!trimmedLabel) { toast.error("Label is required"); return; }
    if (!trimmedKey) { toast.error("Key is required (auto-fills from Label)"); return; }
    const parsed = presetSchema.safeParse({ key: trimmedKey, label: trimmedLabel, description: description || undefined, family });
    if (!parsed.success) { toast.error(parsed.error.issues[0].message); return; }
    create.mutate({ key: trimmedKey, label: trimmedLabel, description: description || undefined, family, content }, { onSuccess: onClose });
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {initialDraft && <Sparkles className="h-4 w-4 text-primary" />}
            New service preset
          </DialogTitle>
        </DialogHeader>
        {initialDraft && (
          <div className="rounded-md border border-primary/30 bg-primary/5 p-3 text-sm">
            <span className="font-medium">AI-generated draft.</span>{" "}
            Review every field below — hover the <Info className="inline h-3 w-3" /> icons to see why each section was chosen. Edits are saved as v1.
          </div>
        )}
        <PresetFormBody
          metaLabel={label} onMetaLabel={handleLabel}
          metaKey={key} onMetaKey={handleKey}
          metaDesc={description} onMetaDesc={setDescription}
          metaFamily={family} onMetaFamily={setFamily}
          content={content} onContent={setContent}
          reasoning={reasoning}
          showKey
        />
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={submit} disabled={create.isPending}>Create</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function EditDialog({ preset, open, onClose }: { preset: PresetRow; open: boolean; onClose: () => void }) {
  const { data: current, isLoading } = usePresetCurrentContent(preset);
  const save = useSavePresetVersion();
  const [label, setLabel] = useState(preset.label);
  const [description, setDescription] = useState(preset.description ?? "");
  const [content, setContent] = useState<PresetContent | null>(null);
  const [note, setNote] = useState("");

  // Initialize once when content loads
  if (content === null && current) {
    setContent(current.content);
  }

  const submit = () => {
    if (!content) return;
    if (label.trim().length < 2) { toast.error("Label too short"); return; }
    save.mutate(
      { preset, content, label, description, change_note: note || undefined },
      { onSuccess: onClose }
    );
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            Edit {preset.label}
            {preset.is_builtin && <Badge variant="secondary" className="ml-2">built-in (read-only)</Badge>}
          </DialogTitle>
        </DialogHeader>
        {isLoading || !content ? (
          <p className="text-sm text-muted-foreground">Loading…</p>
        ) : (
          <>
            <PresetFormBody
              metaLabel={label} onMetaLabel={setLabel}
              metaKey={preset.key} onMetaKey={() => {}}
              metaDesc={description} onMetaDesc={setDescription}
              metaFamily={preset.family as "federal" | "utility"} onMetaFamily={() => {}}
              content={content} onContent={setContent}
              readOnly={preset.is_builtin}
            />
            {!preset.is_builtin && (
              <div className="space-y-2">
                <Label>Change note (optional)</Label>
                <Input value={note} onChange={(e) => setNote(e.target.value)} placeholder="What changed in this version?" />
              </div>
            )}
            <DialogFooter>
              <Button variant="outline" onClick={onClose}>Close</Button>
              {!preset.is_builtin && (
                <Button onClick={submit} disabled={save.isPending}>Save new version</Button>
              )}
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

function HistoryDialog({ preset, open, onClose }: { preset: PresetRow; open: boolean; onClose: () => void }) {
  const { data: versions = [], isLoading } = usePresetVersions(preset.id);
  const rollback = useRollbackPreset();

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Version history — {preset.label}</DialogTitle>
        </DialogHeader>
        {isLoading && <p className="text-sm text-muted-foreground">Loading…</p>}
        <div className="space-y-2">
          {versions.map((v) => {
            const isCurrent = v.id === preset.current_version_id;
            return (
              <div key={v.id} className="flex items-start justify-between gap-3 border rounded p-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-medium">v{v.version}</span>
                    {isCurrent && <Badge variant="default" className="text-xs">current</Badge>}
                    <span className="text-xs text-muted-foreground">{new Date(v.created_at).toLocaleString()}</span>
                  </div>
                  {v.change_note && <p className="text-xs text-muted-foreground mt-1">{v.change_note}</p>}
                </div>
                {!preset.is_builtin && !isCurrent && (
                  <Button size="sm" variant="outline" onClick={() => rollback.mutate({ preset, version: v })}>
                    <RotateCcw className="h-3 w-3 mr-1" /> Roll back
                  </Button>
                )}
              </div>
            );
          })}
        </div>
        <DialogFooter><Button variant="outline" onClick={onClose}>Close</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ReasoningHint({ text }: { text?: string }) {
  if (!text) return null;
  return (
    <TooltipProvider delayDuration={200}>
      <Tooltip>
        <TooltipTrigger asChild>
          <button type="button" className="inline-flex items-center text-primary/70 hover:text-primary" aria-label="Why these values?">
            <Info className="h-3.5 w-3.5" />
          </button>
        </TooltipTrigger>
        <TooltipContent className="max-w-xs text-xs">{text}</TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

function HintLabel({ children, hint }: { children: React.ReactNode; hint?: string }) {
  return (
    <Label className="inline-flex items-center gap-1.5">
      {children}
      <ReasoningHint text={hint} />
    </Label>
  );
}

function PresetFormBody(props: {
  metaLabel: string; onMetaLabel: (v: string) => void;
  metaKey: string; onMetaKey: (v: string) => void;
  metaDesc: string; onMetaDesc: (v: string) => void;
  metaFamily: "federal" | "utility"; onMetaFamily: (v: "federal" | "utility") => void;
  content: PresetContent; onContent: (c: PresetContent) => void;
  reasoning?: PresetReasoning;
  showKey?: boolean; readOnly?: boolean;
}) {
  const c = props.content;
  const r = props.reasoning ?? {};
  const set = (patch: Partial<PresetContent>) => props.onContent({ ...c, ...patch });

  // Helper: tag editor with hint as label
  const TagEditorH = ({ label, hint, values, onChange, placeholder }: { label: string; hint?: string; values: string[]; onChange: (v: string[]) => void; placeholder?: string }) => (
    <TagEditor label={<HintLabel hint={hint}>{label}</HintLabel>} values={values} onChange={onChange} placeholder={placeholder} />
  );

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>Label</Label>
          <Input value={props.metaLabel} onChange={(e) => props.onMetaLabel(e.target.value)} disabled={props.readOnly} maxLength={120} />
        </div>
        {props.showKey && (
          <div className="space-y-2">
            <Label>Key</Label>
            <Input value={props.metaKey} onChange={(e) => props.onMetaKey(e.target.value)} placeholder="my_preset_key" maxLength={64} />
          </div>
        )}
        <div className="space-y-2 md:col-span-2">
          <Label>Description</Label>
          <Textarea value={props.metaDesc} onChange={(e) => props.onMetaDesc(e.target.value)} disabled={props.readOnly} maxLength={500} rows={2} />
        </div>
        <div className="space-y-2">
          <Label>Family</Label>
          <Select value={props.metaFamily} onValueChange={(v) => props.onMetaFamily(v as "federal" | "utility")} disabled={props.readOnly || !props.showKey}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="federal">Federal</SelectItem>
              <SelectItem value="utility">Utility supplier</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <Tabs defaultValue="codes">
        <TabsList>
          <TabsTrigger value="codes">Codes & buyers</TabsTrigger>
          <TabsTrigger value="compliance">Compliance & flags</TabsTrigger>
          <TabsTrigger value="voice">Voice</TabsTrigger>
        </TabsList>
        <TabsContent value="codes" className="space-y-4 mt-4">
          <fieldset disabled={props.readOnly} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <TagEditorH label="NAICS codes" hint={r.naics_codes} values={c.naics_codes ?? []} onChange={(v) => set({ naics_codes: v })} placeholder="541512" />
              <TagEditorH label="PSC codes" hint={r.psc_codes} values={c.psc_codes ?? []} onChange={(v) => set({ psc_codes: v })} placeholder="DA01" />
              <TagEditorH label="Set-asides" values={c.set_asides ?? []} onChange={(v) => set({ set_asides: v })} placeholder="8(a)" />
              <TagEditorH label="Agencies / buyers" hint={r.agencies_focus} values={c.agencies_focus ?? []} onChange={(v) => set({ agencies_focus: v })} placeholder="VA / GSA" />
              <TagEditorH label="Contract vehicles" hint={r.contract_vehicles} values={c.contract_vehicles ?? []} onChange={(v) => set({ contract_vehicles: v })} placeholder="GSA MAS" />
              <TagEditorH label="Keywords" values={c.keywords ?? []} onChange={(v) => set({ keywords: v })} placeholder="cloud, modernization" />
            </div>
          </fieldset>
        </TabsContent>
        <TabsContent value="compliance" className="space-y-4 mt-4">
          <fieldset disabled={props.readOnly} className="space-y-4">
            <TagEditorH label="Compliance frameworks" hint={r.compliance_frameworks} values={c.compliance_frameworks ?? []} onChange={(v) => set({ compliance_frameworks: v })} placeholder="NIST 800-53" />
            <div className="space-y-2">
              <HintLabel hint={r.always_flag}>Always-flag rules (one per line, format: rule | reason)</HintLabel>
              <Textarea
                rows={4}
                value={(c.always_flag ?? []).map((f) => `${f.rule} | ${f.reason}`).join("\n")}
                onChange={(e) => {
                  const lines = e.target.value.split("\n").filter((l) => l.trim());
                  set({
                    always_flag: lines.map((l) => {
                      const [rule, ...rest] = l.split("|");
                      return { rule: rule.trim(), reason: rest.join("|").trim() };
                    }),
                  });
                }}
                placeholder="LPTA evaluation criteria | Healthcare IT rarely succeeds under LPTA"
              />
            </div>
          </fieldset>
        </TabsContent>
        <TabsContent value="voice" className="space-y-4 mt-4">
          <fieldset disabled={props.readOnly} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Tone</Label>
                <Select value={c.tone_voice ?? "consultative"} onValueChange={(v) => set({ tone_voice: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="formal">Formal</SelectItem>
                    <SelectItem value="consultative">Consultative</SelectItem>
                    <SelectItem value="technical">Technical</SelectItem>
                    <SelectItem value="plain">Plain</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Reading level (8–16)</Label>
                <Input
                  type="number" min={8} max={16}
                  value={c.reading_level ?? 12}
                  onChange={(e) => set({ reading_level: Math.min(16, Math.max(8, Number(e.target.value) || 12)) })}
                />
              </div>
            </div>
          </fieldset>
        </TabsContent>
      </Tabs>
    </div>
  );
}
