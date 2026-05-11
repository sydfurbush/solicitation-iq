import { useEffect, useMemo, useRef, useState } from "react";
import { Check, CloudOff, Loader2, Pencil, Plus, Save, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { useUpdateClient } from "@/features/clients/hooks/useClients";
import { toast } from "@/hooks/use-toast";
import type { Database } from "@/integrations/supabase/types";

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
}: {
  label: string;
  values: string[];
  onChange: (next: string[]) => void;
  placeholder?: string;
  disabled?: boolean;
}) {
  const [draft, setDraft] = useState("");
  const add = () => {
    const v = draft.trim();
    if (!v) return;
    if (values.includes(v)) {
      setDraft("");
      return;
    }
    onChange([...values, v]);
    setDraft("");
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
        <div className="flex gap-2">
          <Input
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === ",") {
                e.preventDefault();
                add();
              }
            }}
            placeholder={placeholder}
          />
          <Button type="button" variant="outline" size="icon" onClick={add}>
            <Plus className="h-4 w-4" />
          </Button>
        </div>
      )}
    </div>
  );
}

export function CapabilitiesEditor({ client }: { client: ClientRow }) {
  const initial = useMemo(() => parseCapabilities(client.metadata), [client.metadata]);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<Capabilities>(initial);
  const updateMut = useUpdateClient();

  useEffect(() => {
    setDraft(initial);
  }, [initial]);

  const set = <K extends keyof Capabilities>(k: K, v: Capabilities[K]) =>
    setDraft((d) => ({ ...d, [k]: v }));

  const handleSave = async () => {
    const cleaned: Capabilities = {};
    if (draft.core_capabilities?.trim()) cleaned.core_capabilities = draft.core_capabilities.trim();
    if (draft.naics_codes?.length) cleaned.naics_codes = draft.naics_codes;
    if (draft.certifications?.length) cleaned.certifications = draft.certifications;
    if (draft.differentiators?.trim()) cleaned.differentiators = draft.differentiators.trim();
    if (draft.past_performance?.trim()) cleaned.past_performance = draft.past_performance.trim();
    if (draft.key_personnel?.trim()) cleaned.key_personnel = draft.key_personnel.trim();
    if (draft.teaming_partners?.trim()) cleaned.teaming_partners = draft.teaming_partners.trim();
    if (draft.notes?.trim()) cleaned.notes = draft.notes.trim();

    const existingMeta = (client.metadata as Record<string, unknown> | null) ?? {};
    const nextMeta = { ...existingMeta, capabilities: cleaned };

    try {
      await updateMut.mutateAsync({
        id: client.id,
        // metadata is allowed via Partial update through the client hook
        input: { metadata: nextMeta } as never,
      });
      toast({ title: "Capabilities saved" });
      setEditing(false);
    } catch (e) {
      toast({
        title: "Failed to save",
        description: e instanceof Error ? e.message : String(e),
        variant: "destructive",
      });
    }
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
        {!editing ? (
          <Button size="sm" variant="ghost" onClick={() => setEditing(true)}>
            <Pencil className="h-3.5 w-3.5 mr-1" /> Edit
          </Button>
        ) : (
          <div className="flex gap-1">
            <Button
              size="sm"
              variant="ghost"
              onClick={() => {
                setDraft(initial);
                setEditing(false);
              }}
            >
              <X className="h-3.5 w-3.5" />
            </Button>
            <Button size="sm" onClick={handleSave} disabled={updateMut.isPending}>
              <Save className="h-3.5 w-3.5 mr-1" /> Save
            </Button>
          </div>
        )}
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
                placeholder="541512"
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
