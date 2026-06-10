import { useEffect, useMemo, useRef, useState } from "react";
import { Check, CloudOff, FileUp, Loader2, Pencil, Plus, Save, Sparkles, X } from "lucide-react";
import { CapabilityInjectorDialog } from "@/features/clients/components/CapabilityInjectorDialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useUpdateClient } from "@/features/clients/hooks/useClients";
import { toast } from "@/hooks/use-toast";
import type { Database } from "@/integrations/supabase/types";
import { CAPABILITY_TEMPLATES, type CapabilityTemplate } from "@/features/clients/lib/capabilityTemplates";

type ClientRow = Database["public"]["Tables"]["clients"]["Row"];

type Capabilities = {
  core_capabilities?: string;
  naics_codes?: string[];
  certifications?: string[];
  differentiators?: string;
  past_performance?: string;
  key_personnel?: string;
  teaming_partners?: string;
  notes?: string;
};

function parseCapabilities(metadata: ClientRow["metadata"]): Capabilities {
  const caps = (metadata as Record<string, unknown> | null)?.capabilities;
  if (!caps) return {};
  if (typeof caps === "string") return { core_capabilities: caps };
  if (typeof caps === "object") return caps as Capabilities;
  return {};
}

function ChipsInput({
  label,
  values,
  onChange,
  placeholder,
  disabled,
  splitPattern = /[\s,;]+/,
  transform,
  validate,
  helperText,
}: {
  label: string;
  values: string[];
  onChange: (next: string[]) => void;
  placeholder?: string;
  disabled?: boolean;
  /** How to split pasted/typed input into multiple chips. Default: any whitespace, commas, or semicolons. */
  splitPattern?: RegExp;
  /** Normalize each value before validation (e.g. strip non-digits). */
  transform?: (raw: string) => string;
  /** Return an error string to reject the value, or null to accept. */
  validate?: (value: string) => string | null;
  helperText?: string;
}) {
  const [draft, setDraft] = useState("");
  const [error, setError] = useState<string | null>(null);

  const tryAddMany = (raw: string): { added: number; rejected: { value: string; reason: string }[] } => {
    const tokens = raw.split(splitPattern).map((t) => t.trim()).filter(Boolean);
    if (tokens.length === 0) return { added: 0, rejected: [] };

    const next = [...values];
    const rejected: { value: string; reason: string }[] = [];
    for (const t of tokens) {
      const normalized = transform ? transform(t) : t;
      if (!normalized) continue;
      if (next.includes(normalized)) {
        rejected.push({ value: t, reason: "duplicate" });
        continue;
      }
      const err = validate?.(normalized);
      if (err) {
        rejected.push({ value: t, reason: err });
        continue;
      }
      next.push(normalized);
    }
    if (next.length !== values.length) onChange(next);
    return { added: next.length - values.length, rejected };
  };

  const commit = (raw: string, opts: { keepOnError?: boolean } = {}) => {
    if (!raw.trim()) {
      setDraft("");
      setError(null);
      return;
    }
    const { added, rejected } = tryAddMany(raw);
    if (rejected.length > 0) {
      const first = rejected[0];
      setError(`"${first.value}" — ${first.reason}${rejected.length > 1 ? ` (+${rejected.length - 1} more rejected)` : ""}`);
      // If only invalid tokens, optionally keep the input so user can fix it
      setDraft(opts.keepOnError && added === 0 ? raw : "");
    } else {
      setError(null);
      setDraft("");
    }
  };

  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      <div className="flex flex-wrap gap-1.5 min-h-[2rem]">
        {values.length === 0 && (
          <span className="text-xs text-muted-foreground">None added</span>
        )}
        {values.map((v) => (
          <Badge key={v} variant="secondary" className="gap-1">
            {v}
            {!disabled && (
              <button
                type="button"
                onClick={() => onChange(values.filter((x) => x !== v))}
                className="hover:text-destructive"
                aria-label={`Remove ${v}`}
              >
                <X className="h-3 w-3" />
              </button>
            )}
          </Badge>
        ))}
      </div>
      {!disabled && (
        <>
          <div className="flex gap-2">
            <Input
              value={draft}
              onChange={(e) => {
                const v = e.target.value;
                // If user typed a separator, auto-commit completed tokens
                if (splitPattern.test(v)) {
                  commit(v, { keepOnError: true });
                } else {
                  setDraft(v);
                  if (error) setError(null);
                }
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  commit(draft, { keepOnError: true });
                } else if (e.key === "Backspace" && draft === "" && values.length > 0) {
                  // quick-delete last chip
                  onChange(values.slice(0, -1));
                }
              }}
              onBlur={() => commit(draft, { keepOnError: true })}
              onPaste={(e) => {
                const text = e.clipboardData.getData("text");
                if (text && splitPattern.test(text)) {
                  e.preventDefault();
                  commit(text, { keepOnError: true });
                }
              }}
              placeholder={placeholder}
              aria-invalid={!!error}
            />
            <Button type="button" variant="outline" size="icon" onClick={() => commit(draft, { keepOnError: true })}>
              <Plus className="h-4 w-4" />
            </Button>
          </div>
          {error ? (
            <p className="text-xs text-destructive">{error}</p>
          ) : helperText ? (
            <p className="text-xs text-muted-foreground">{helperText}</p>
          ) : null}
        </>
      )}
    </div>
  );
}

const NAICS_REGEX = /^\d{6}$/;
const validateNaics = (v: string) => (NAICS_REGEX.test(v) ? null : "NAICS must be exactly 6 digits");
const transformNaics = (v: string) => v.replace(/\D/g, "");

function buildCleaned(draft: Capabilities): Capabilities {
  const cleaned: Capabilities = {};
  if (draft.core_capabilities?.trim()) cleaned.core_capabilities = draft.core_capabilities.trim();
  if (draft.naics_codes?.length) cleaned.naics_codes = draft.naics_codes;
  if (draft.certifications?.length) cleaned.certifications = draft.certifications;
  if (draft.differentiators?.trim()) cleaned.differentiators = draft.differentiators.trim();
  if (draft.past_performance?.trim()) cleaned.past_performance = draft.past_performance.trim();
  if (draft.key_personnel?.trim()) cleaned.key_personnel = draft.key_personnel.trim();
  if (draft.teaming_partners?.trim()) cleaned.teaming_partners = draft.teaming_partners.trim();
  if (draft.notes?.trim()) cleaned.notes = draft.notes.trim();
  return cleaned;
}

type SaveStatus = "idle" | "unsaved" | "saving" | "saved" | "error";

function relTime(d: Date | null): string {
  if (!d) return "";
  const s = Math.max(0, Math.round((Date.now() - d.getTime()) / 1000));
  if (s < 5) return "just now";
  if (s < 60) return `${s}s ago`;
  const m = Math.round(s / 60);
  if (m < 60) return `${m} min${m === 1 ? "" : "s"} ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h}h ago`;
  return d.toLocaleString();
}

function SaveIndicator({ status, savedAt, error }: { status: SaveStatus; savedAt: Date | null; error?: string | null }) {
  // Refresh the relative timestamp every 30s
  const [, force] = useState(0);
  useEffect(() => {
    if (!savedAt) return;
    const i = setInterval(() => force((n) => n + 1), 30_000);
    return () => clearInterval(i);
  }, [savedAt]);

  if (status === "saving") {
    return (
      <span className="text-xs text-muted-foreground inline-flex items-center gap-1.5">
        <Loader2 className="h-3 w-3 animate-spin" /> Saving…
      </span>
    );
  }
  if (status === "error") {
    return (
      <span className="text-xs text-destructive inline-flex items-center gap-1.5" title={error ?? undefined}>
        <CloudOff className="h-3 w-3" /> Save failed — retrying on next change
      </span>
    );
  }
  if (status === "unsaved") {
    return <span className="text-xs text-amber-600 inline-flex items-center gap-1.5">● Unsaved changes</span>;
  }
  if (savedAt) {
    return (
      <span className="text-xs text-muted-foreground inline-flex items-center gap-1.5">
        <Check className="h-3 w-3 text-emerald-600" /> Saved {relTime(savedAt)}
      </span>
    );
  }
  return null;
}

export function CapabilitiesEditor({ client }: { client: ClientRow }) {
  const initial = useMemo(() => parseCapabilities(client.metadata), [client.metadata]);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<Capabilities>(initial);
  const updateMut = useUpdateClient();

  const [status, setStatus] = useState<SaveStatus>("idle");
  const [savedAt, setSavedAt] = useState<Date | null>(client.updated_at ? new Date(client.updated_at) : null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [pendingTemplate, setPendingTemplate] = useState<CapabilityTemplate | null>(null);
  const [injectorOpen, setInjectorOpen] = useState(false);

  const applyTemplate = (tpl: CapabilityTemplate, mode: "merge" | "replace") => {
    const base: Capabilities = mode === "replace" ? {} : { ...draft };
    const mergeText = (a?: string, b?: string) => {
      const aa = (a ?? "").trim();
      const bb = (b ?? "").trim();
      if (!aa) return bb || undefined;
      if (!bb) return aa || undefined;
      if (aa.toLowerCase().includes(bb.toLowerCase())) return aa;
      return `${aa}\n\n${bb}`;
    };
    const mergeChips = (a?: string[], b?: string[]) => {
      const set = new Set<string>([...(a ?? []), ...(b ?? [])]);
      return Array.from(set);
    };
    const next: Capabilities = {
      core_capabilities:
        mode === "replace"
          ? tpl.data.core_capabilities
          : mergeText(base.core_capabilities, tpl.data.core_capabilities),
      differentiators:
        mode === "replace"
          ? tpl.data.differentiators
          : mergeText(base.differentiators, tpl.data.differentiators),
      past_performance:
        mode === "replace"
          ? tpl.data.past_performance
          : mergeText(base.past_performance, tpl.data.past_performance),
      key_personnel:
        mode === "replace" ? tpl.data.key_personnel : mergeText(base.key_personnel, tpl.data.key_personnel),
      teaming_partners:
        mode === "replace"
          ? tpl.data.teaming_partners
          : mergeText(base.teaming_partners, tpl.data.teaming_partners),
      notes: mode === "replace" ? tpl.data.notes : mergeText(base.notes, tpl.data.notes),
      naics_codes:
        mode === "replace" ? tpl.data.naics_codes ?? [] : mergeChips(base.naics_codes, tpl.data.naics_codes),
      certifications:
        mode === "replace"
          ? tpl.data.certifications ?? []
          : mergeChips(base.certifications, tpl.data.certifications),
    };
    setDraft(next);
    setEditing(true);
    setPendingTemplate(null);
    toast({
      title: `Applied "${tpl.name}" template`,
      description: mode === "replace" ? "Existing fields were replaced." : "Merged into existing fields.",
    });
  };

  const handleTemplatePick = (tpl: CapabilityTemplate) => {
    const hasContent = Object.keys(buildCleaned(draft)).length > 0;
    if (hasContent) {
      setPendingTemplate(tpl);
    } else {
      applyTemplate(tpl, "replace");
    }
  };

  const lastSavedJsonRef = useRef<string>(JSON.stringify(buildCleaned(initial)));
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    setDraft(initial);
    lastSavedJsonRef.current = JSON.stringify(buildCleaned(initial));
  }, [initial]);

  const set = <K extends keyof Capabilities>(k: K, v: Capabilities[K]) =>
    setDraft((d) => ({ ...d, [k]: v }));

  const persist = async (cleaned: Capabilities) => {
    const existingMeta = (client.metadata as Record<string, unknown> | null) ?? {};
    const nextMeta = { ...existingMeta, capabilities: cleaned };
    setStatus("saving");
    try {
      await updateMut.mutateAsync({
        id: client.id,
        input: { metadata: nextMeta } as never,
      });
      lastSavedJsonRef.current = JSON.stringify(cleaned);
      setSavedAt(new Date());
      setErrorMsg(null);
      setStatus("saved");
    } catch (e) {
      setErrorMsg(e instanceof Error ? e.message : String(e));
      setStatus("error");
      throw e;
    }
  };

  // Debounced autosave while editing
  useEffect(() => {
    if (!editing) return;
    const cleaned = buildCleaned(draft);
    const json = JSON.stringify(cleaned);
    if (json === lastSavedJsonRef.current) return;
    setStatus("unsaved");
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      persist(cleaned).catch(() => {});
    }, 1200);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draft, editing]);

  // Flush pending save when leaving edit mode
  const handleDone = async () => {
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
      debounceRef.current = null;
    }
    const cleaned = buildCleaned(draft);
    if (JSON.stringify(cleaned) !== lastSavedJsonRef.current) {
      try {
        await persist(cleaned);
        toast({ title: "Capabilities saved" });
      } catch {
        toast({ title: "Failed to save", description: errorMsg ?? "Try again", variant: "destructive" });
        return;
      }
    }
    setEditing(false);
  };

  const handleCancel = () => {
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
      debounceRef.current = null;
    }
    setDraft(initial);
    lastSavedJsonRef.current = JSON.stringify(buildCleaned(initial));
    setStatus("idle");
    setEditing(false);
  };

  const isEmpty =
    !initial.core_capabilities &&
    !initial.naics_codes?.length &&
    !initial.certifications?.length &&
    !initial.differentiators &&
    !initial.past_performance &&
    !initial.key_personnel &&
    !initial.teaming_partners &&
    !initial.notes;

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0">
        <div>
          <CardTitle className="text-base">Capabilities profile</CardTitle>
          <p className="text-xs text-muted-foreground mt-1">
            Used by Deep Dive gap analysis to compare requirements against what this client can deliver.
          </p>
        </div>
        <div className="flex items-center gap-3">
          {editing && <SaveIndicator status={status} savedAt={savedAt} error={errorMsg} />}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button size="sm" variant="outline">
                <Sparkles className="h-3.5 w-3.5 mr-1" /> Templates
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-72">
              <DropdownMenuLabel>Apply a capability template</DropdownMenuLabel>
              <DropdownMenuSeparator />
              {CAPABILITY_TEMPLATES.map((tpl) => (
                <DropdownMenuItem
                  key={tpl.id}
                  className="flex flex-col items-start gap-0.5 py-2"
                  onSelect={(e) => {
                    e.preventDefault();
                    handleTemplatePick(tpl);
                  }}
                >
                  <span className="font-medium text-sm">{tpl.name}</span>
                  <span className="text-xs text-muted-foreground">{tpl.description}</span>
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
          {!editing ? (
            <Button size="sm" variant="ghost" onClick={() => setEditing(true)}>
              <Pencil className="h-3.5 w-3.5 mr-1" /> Edit
            </Button>
          ) : (
            <div className="flex gap-1">
              <Button size="sm" variant="ghost" onClick={handleCancel} disabled={status === "saving"}>
                <X className="h-3.5 w-3.5" />
              </Button>
              <Button size="sm" onClick={handleDone} disabled={status === "saving"}>
                <Save className="h-3.5 w-3.5 mr-1" /> Done
              </Button>
            </div>
          )}
        </div>
      </CardHeader>
      <CardContent>
        {editing ? (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Core capabilities</Label>
              <Textarea
                rows={3}
                value={draft.core_capabilities ?? ""}
                onChange={(e) => set("core_capabilities", e.target.value)}
                placeholder="e.g. Cloud migration, cybersecurity engineering, software dev (Agile/SAFe)..."
              />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <ChipsInput
                label="NAICS codes"
                values={draft.naics_codes ?? []}
                onChange={(v) => set("naics_codes", v)}
                placeholder="541512, 541511 541519"
                transform={transformNaics}
                validate={validateNaics}
                helperText="6-digit codes. Separate with comma, space, or Enter; paste a list and we'll split it."
              />
              <ChipsInput
                label="Certifications & set-asides"
                values={draft.certifications ?? []}
                onChange={(v) => set("certifications", v)}
                placeholder="CMMC L2, 8(a), SDVOSB, ISO 27001"
              />
            </div>
            <div className="space-y-2">
              <Label>Differentiators</Label>
              <Textarea
                rows={2}
                value={draft.differentiators ?? ""}
                onChange={(e) => set("differentiators", e.target.value)}
                placeholder="What sets this client apart from competitors?"
              />
            </div>
            <div className="space-y-2">
              <Label>Past performance</Label>
              <Textarea
                rows={3}
                value={draft.past_performance ?? ""}
                onChange={(e) => set("past_performance", e.target.value)}
                placeholder="Relevant prior contracts, agencies, contract values, outcomes..."
              />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Key personnel</Label>
                <Textarea
                  rows={2}
                  value={draft.key_personnel ?? ""}
                  onChange={(e) => set("key_personnel", e.target.value)}
                  placeholder="Cleared PM, Chief Architect, etc."
                />
              </div>
              <div className="space-y-2">
                <Label>Teaming partners</Label>
                <Textarea
                  rows={2}
                  value={draft.teaming_partners ?? ""}
                  onChange={(e) => set("teaming_partners", e.target.value)}
                  placeholder="Subs, primes, OEMs..."
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Additional notes</Label>
              <Textarea
                rows={2}
                value={draft.notes ?? ""}
                onChange={(e) => set("notes", e.target.value)}
                placeholder="Anything else useful for gap analysis"
              />
            </div>
          </div>
        ) : isEmpty ? (
          <p className="text-sm text-muted-foreground">
            No capabilities profile yet. Add one to power gap analysis in Deep Dive.
          </p>
        ) : (
          <div className="space-y-4 text-sm">
            {initial.core_capabilities && (
              <Field label="Core capabilities" value={initial.core_capabilities} />
            )}
            {initial.naics_codes?.length ? (
              <Chips label="NAICS codes" values={initial.naics_codes} />
            ) : null}
            {initial.certifications?.length ? (
              <Chips label="Certifications & set-asides" values={initial.certifications} />
            ) : null}
            {initial.differentiators && (
              <Field label="Differentiators" value={initial.differentiators} />
            )}
            {initial.past_performance && (
              <Field label="Past performance" value={initial.past_performance} />
            )}
            {initial.key_personnel && <Field label="Key personnel" value={initial.key_personnel} />}
            {initial.teaming_partners && (
              <Field label="Teaming partners" value={initial.teaming_partners} />
            )}
            {initial.notes && <Field label="Notes" value={initial.notes} />}
          </div>
        )}
      </CardContent>

      <AlertDialog open={!!pendingTemplate} onOpenChange={(o) => !o && setPendingTemplate(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Apply "{pendingTemplate?.name}" template?</AlertDialogTitle>
            <AlertDialogDescription>
              This profile already has content. Choose how to apply the template:
              <span className="block mt-2"><strong>Merge</strong> appends new text and adds new chips without removing what's there.</span>
              <span className="block mt-1"><strong>Replace</strong> overwrites every field with the template's values.</span>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="gap-2">
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <Button
              variant="outline"
              onClick={() => pendingTemplate && applyTemplate(pendingTemplate, "merge")}
            >
              Merge
            </Button>
            <AlertDialogAction
              onClick={() => pendingTemplate && applyTemplate(pendingTemplate, "replace")}
            >
              Replace
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs uppercase tracking-wide text-muted-foreground mb-1">{label}</p>
      <p className="whitespace-pre-wrap">{value}</p>
    </div>
  );
}

function Chips({ label, values }: { label: string; values: string[] }) {
  return (
    <div>
      <p className="text-xs uppercase tracking-wide text-muted-foreground mb-1.5">{label}</p>
      <div className="flex flex-wrap gap-1.5">
        {values.map((v) => (
          <Badge key={v} variant="secondary">
            {v}
          </Badge>
        ))}
      </div>
    </div>
  );
}
