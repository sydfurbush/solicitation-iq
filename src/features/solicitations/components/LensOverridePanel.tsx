import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, Save, Sparkles, Trash2, Undo2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useClientProfile } from "@/features/clients/hooks/useClientProfile";

const TONE_OPTIONS = [
  { v: "formal", label: "Formal" },
  { v: "consultative", label: "Consultative" },
  { v: "technical", label: "Technical" },
  { v: "plain", label: "Plain language" },
];

type OverrideKey =
  | "naics_codes"
  | "psc_codes"
  | "set_asides"
  | "agencies_focus"
  | "contract_vehicles"
  | "compliance_frameworks"
  | "tone_voice";

interface OverrideShape {
  naics_codes?: string[];
  psc_codes?: string[];
  set_asides?: string[];
  agencies_focus?: string[];
  contract_vehicles?: string[];
  compliance_frameworks?: string[];
  tone_voice?: string;
}

function TagEditor({
  label,
  values,
  onChange,
  placeholder,
  baseline,
}: {
  label: string;
  values: string[];
  onChange: (v: string[]) => void;
  placeholder?: string;
  baseline?: string[];
}) {
  const [draft, setDraft] = useState("");
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <Label className="text-xs">{label}</Label>
        {baseline && baseline.length > 0 && (
          <span className="text-[10px] text-muted-foreground">
            client lens: {baseline.join(", ")}
          </span>
        )}
      </div>
      <div className="flex flex-wrap gap-1.5 min-h-[28px]">
        {values.map((v, i) => (
          <Badge key={`${v}-${i}`} variant="secondary" className="gap-1.5">
            {v}
            <button
              type="button"
              onClick={() => onChange(values.filter((_, idx) => idx !== i))}
              aria-label={`Remove ${v}`}
              className="hover:text-destructive"
            >
              <Trash2 className="h-3 w-3" />
            </button>
          </Badge>
        ))}
        {values.length === 0 && (
          <span className="text-xs text-muted-foreground italic">No override — using client lens.</span>
        )}
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
          className="h-8"
        />
        <Button
          type="button"
          variant="outline"
          size="icon"
          className="h-8 w-8"
          onClick={() => {
            if (draft.trim()) {
              onChange([...values, draft.trim()]);
              setDraft("");
            }
          }}
        >
          <Plus className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}

export function LensOverridePanel({
  solicitationId,
  clientId,
}: {
  solicitationId: string;
  clientId?: string | null;
}) {
  const qc = useQueryClient();
  const { data: clientProfile } = useClientProfile(clientId ?? undefined);

  const { data: sol } = useQuery({
    queryKey: ["sol-lens-overrides", solicitationId],
    enabled: !!solicitationId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("solicitations")
        .select("id, lens_overrides")
        .eq("id", solicitationId)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  const initial = (sol?.lens_overrides as OverrideShape | null) ?? null;
  const enabledInitial = !!initial && Object.keys(initial).length > 0;

  const [enabled, setEnabled] = useState(enabledInitial);
  const [draft, setDraft] = useState<OverrideShape>(initial ?? {});

  useEffect(() => {
    setEnabled(!!sol?.lens_overrides && Object.keys(sol?.lens_overrides as object).length > 0);
    setDraft(((sol?.lens_overrides as OverrideShape | null) ?? {}) as OverrideShape);
  }, [sol?.lens_overrides]);

  const setKey = <K extends OverrideKey>(key: K, value: OverrideShape[K]) => {
    setDraft((d) => {
      const next = { ...d };
      const isEmptyArr = Array.isArray(value) && (value as string[]).length === 0;
      const isEmptyStr = typeof value === "string" && value.trim() === "";
      if (value === undefined || value === null || isEmptyArr || isEmptyStr) {
        delete next[key];
      } else {
        (next as Record<string, unknown>)[key] = value;
      }
      return next;
    });
  };

  const save = useMutation({
    mutationFn: async () => {
      const payload: Record<string, unknown> = enabled ? { ...draft } : {};
      const { error } = await supabase
        .from("solicitations")
        .update({ lens_overrides: payload as never })
        .eq("id", solicitationId);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["sol-lens-overrides", solicitationId] });
      toast({
        title: enabled ? "Lens override saved" : "Override cleared",
        description: enabled
          ? "Future AI runs on this solicitation will use these adjustments."
          : "AI runs will use the client lens as-is.",
      });
    },
    onError: (e) =>
      toast({
        title: "Save failed",
        description: e instanceof Error ? e.message : String(e),
        variant: "destructive",
      }),
  });

  const overriddenCount = useMemo(
    () => (enabled ? Object.keys(draft).length : 0),
    [enabled, draft],
  );

  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between gap-3">
        <div>
          <CardTitle className="text-base flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-primary" /> Lens override
            {overriddenCount > 0 && (
              <Badge variant="outline" className="text-[10px]">
                {overriddenCount} field{overriddenCount === 1 ? "" : "s"} overridden
              </Badge>
            )}
          </CardTitle>
          <p className="text-sm text-muted-foreground mt-1">
            Use a different NAICS, compliance, or evaluation context for this single solicitation.
            Anything you set here replaces the client lens for AI analyses on this opportunity.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Label htmlFor="lens-override-toggle" className="text-xs text-muted-foreground">
            Enable
          </Label>
          <Switch
            id="lens-override-toggle"
            checked={enabled}
            onCheckedChange={(v) => setEnabled(v)}
          />
        </div>
      </CardHeader>

      {enabled && (
        <CardContent className="space-y-5">
          {!clientProfile && (
            <p className="text-xs text-amber-600 dark:text-amber-500">
              No client lens is configured for this client yet. Overrides will still apply, but
              consider building a base lens on the client's AI Lens tab first.
            </p>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <TagEditor
              label="NAICS codes"
              values={draft.naics_codes ?? []}
              onChange={(v) => setKey("naics_codes", v)}
              placeholder="e.g. 541512"
              baseline={clientProfile?.naics_codes ?? []}
            />
            <TagEditor
              label="PSC codes"
              values={draft.psc_codes ?? []}
              onChange={(v) => setKey("psc_codes", v)}
              placeholder="e.g. DA01"
              baseline={clientProfile?.psc_codes ?? []}
            />
            <TagEditor
              label="Set-asides"
              values={draft.set_asides ?? []}
              onChange={(v) => setKey("set_asides", v)}
              placeholder="e.g. 8(a)"
              baseline={clientProfile?.set_asides ?? []}
            />
            <TagEditor
              label="Agencies of focus"
              values={draft.agencies_focus ?? []}
              onChange={(v) => setKey("agencies_focus", v)}
              baseline={clientProfile?.agencies_focus ?? []}
            />
            <TagEditor
              label="Contract vehicles"
              values={draft.contract_vehicles ?? []}
              onChange={(v) => setKey("contract_vehicles", v)}
              baseline={clientProfile?.contract_vehicles ?? []}
            />
            <TagEditor
              label="Compliance frameworks"
              values={draft.compliance_frameworks ?? []}
              onChange={(v) => setKey("compliance_frameworks", v)}
              placeholder="e.g. CMMC L2"
              baseline={clientProfile?.compliance_frameworks ?? []}
            />
          </div>

          <Separator />

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label className="text-xs">Voice</Label>
                {clientProfile?.tone_voice && (
                  <span className="text-[10px] text-muted-foreground">
                    client lens: {clientProfile.tone_voice}
                  </span>
                )}
              </div>
              <Select
                value={draft.tone_voice ?? "__inherit"}
                onValueChange={(v) => setKey("tone_voice", v === "__inherit" ? undefined : v)}
              >
                <SelectTrigger className="h-9">
                  <SelectValue placeholder="Inherit from client lens" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__inherit">Inherit from client lens</SelectItem>
                  {TONE_OPTIONS.map((o) => (
                    <SelectItem key={o.v} value={o.v}>
                      {o.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      )}

      <CardContent className="flex justify-between gap-2 pt-0">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => {
            setDraft((sol?.lens_overrides as OverrideShape | null) ?? {});
            setEnabled(!!sol?.lens_overrides && Object.keys(sol?.lens_overrides as object).length > 0);
          }}
          disabled={save.isPending}
        >
          <Undo2 className="mr-2 h-3.5 w-3.5" /> Reset
        </Button>
        <Button onClick={() => save.mutate()} disabled={save.isPending} size="sm">
          <Save className="mr-2 h-4 w-4" />
          {enabled ? "Save override" : "Clear override"}
        </Button>
      </CardContent>
    </Card>
  );
}
