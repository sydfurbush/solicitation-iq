import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Loader2, Sparkles, Quote } from "lucide-react";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";
import {
  useDeriveFormatProfile,
  type DerivedFormatProfile,
} from "@/features/formatProfiles/hooks/useDeriveFormatProfile";
import { useCreateFormatProfile } from "@/features/formatProfiles/hooks/useFormatProfiles";

interface Props {
  solicitationId: string;
  solicitationNumber?: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

function limitsToText(json: Record<string, number | null> | undefined): string {
  if (!json) return "";
  return Object.entries(json)
    .filter(([, v]) => typeof v === "number")
    .map(([k, v]) => `${k}=${v}`)
    .join("\n");
}

function parseLimits(text: string): Record<string, number> {
  const out: Record<string, number> = {};
  for (const raw of text.split(/\n+/)) {
    const line = raw.trim();
    if (!line) continue;
    const [k, v] = line.split("=").map((s) => s.trim());
    if (k && v && !isNaN(Number(v))) out[k] = Number(v);
  }
  return out;
}

interface FormState {
  font: string;
  size_pt: number;
  margins_in: number;
  line_spacing: number;
  page_number_format: string;
  file_name_pattern: string;
  volume_page_limits_text: string;
  notes: string;
}

const DEFAULTS: FormState = {
  font: "Times New Roman",
  size_pt: 12,
  margins_in: 1,
  line_spacing: 1,
  page_number_format: "{volume} - {page} of {pages}",
  file_name_pattern: "{firm}_{solnumber}_{volume}",
  volume_page_limits_text: "",
  notes: "",
};

function fromDerived(p: DerivedFormatProfile): FormState {
  return {
    font: p.font ?? DEFAULTS.font,
    size_pt: typeof p.size_pt === "number" ? p.size_pt : DEFAULTS.size_pt,
    margins_in: typeof p.margins_in === "number" ? p.margins_in : DEFAULTS.margins_in,
    line_spacing: typeof p.line_spacing === "number" ? p.line_spacing : DEFAULTS.line_spacing,
    page_number_format: p.page_number_format ?? DEFAULTS.page_number_format,
    file_name_pattern: p.file_name_pattern ?? DEFAULTS.file_name_pattern,
    volume_page_limits_text: limitsToText(p.volume_page_limits),
    notes: p.notes ?? "",
  };
}

export function DeriveFormatDialog({ solicitationId, solicitationNumber, open, onOpenChange }: Props) {
  const derive = useDeriveFormatProfile(solicitationId);
  const create = useCreateFormatProfile();
  const qc = useQueryClient();
  const [form, setForm] = useState<FormState>(DEFAULTS);
  const [citations, setCitations] = useState<Record<string, { quote?: string; l_reference?: string }>>({});
  const [unresolved, setUnresolved] = useState<string[]>([]);
  const [profileName, setProfileName] = useState("");
  const [hasResult, setHasResult] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) {
      setForm(DEFAULTS);
      setCitations({});
      setUnresolved([]);
      setProfileName(`Auto — ${solicitationNumber ?? "solicitation"}`);
      setHasResult(false);
    }
  }, [open, solicitationNumber]);

  const run = async () => {
    try {
      const r = await derive.mutateAsync();
      setForm(fromDerived(r.profile));
      setCitations(r.citations ?? {});
      setUnresolved(r.unresolved ?? []);
      setHasResult(true);
      toast.success(`Extracted from ${r.sections_considered} section(s)`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to extract");
    }
  };

  const set = <K extends keyof FormState>(k: K, v: FormState[K]) =>
    setForm((f) => ({ ...f, [k]: v }));

  const onSave = async () => {
    if (!profileName.trim()) {
      toast.error("Name required");
      return;
    }
    setSaving(true);
    try {
      const created = await create.mutateAsync({
        name: profileName.trim(),
        vertical: "federal",
        font: form.font,
        size_pt: Number(form.size_pt),
        margins_in: Number(form.margins_in),
        line_spacing: Number(form.line_spacing),
        page_number_format: form.page_number_format,
        file_name_pattern: form.file_name_pattern,
        volume_page_limits: parseLimits(form.volume_page_limits_text),
        notes: form.notes || null,
        is_default: false,
      });
      const { error } = await supabase
        .from("solicitations")
        .update({ format_profile_id: created.id })
        .eq("id", solicitationId);
      if (error) throw error;
      qc.invalidateQueries({ queryKey: ["solicitation", solicitationId] });
      qc.invalidateQueries({ queryKey: ["format-profile-for-solicitation", solicitationId] });
      toast.success("Format profile saved and linked");
      onOpenChange(false);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Save failed");
    } finally {
      setSaving(false);
    }
  };

  const Cite = ({ field }: { field: string }) => {
    const c = citations[field];
    if (!c?.quote) return null;
    return (
      <Popover>
        <PopoverTrigger asChild>
          <button className="inline-flex items-center gap-1 text-[10px] text-muted-foreground hover:text-foreground">
            <Quote className="h-3 w-3" /> source
          </button>
        </PopoverTrigger>
        <PopoverContent className="w-80 text-xs">
          {c.l_reference && <div className="font-semibold mb-1">{c.l_reference}</div>}
          <div className="italic">"{c.quote}"</div>
        </PopoverContent>
      </Popover>
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Derive format from solicitation</DialogTitle>
          <DialogDescription>
            Reads Section L and proposes font, size, margins, page limits, and pagination. Review and edit before saving.
          </DialogDescription>
        </DialogHeader>

        {!hasResult ? (
          <div className="py-6 flex flex-col items-center gap-3">
            <p className="text-sm text-muted-foreground text-center max-w-md">
              The extractor pulls the Instructions to Offerors text already processed for this solicitation and proposes a format profile.
            </p>
            <Button onClick={run} disabled={derive.isPending}>
              {derive.isPending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Sparkles className="h-4 w-4 mr-2" />}
              Extract from Section L
            </Button>
          </div>
        ) : (
          <div className="space-y-4">
            {unresolved.length > 0 && (
              <div className="rounded-md border border-dashed p-3 text-xs text-muted-foreground">
                <span className="font-medium">Not found in Section L:</span> {unresolved.join(", ")} — defaults used; edit as needed.
              </div>
            )}

            <div className="space-y-1.5">
              <Label>Profile name</Label>
              <Input value={profileName} onChange={(e) => setProfileName(e.target.value)} />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <div className="flex items-center justify-between"><Label>Font</Label><Cite field="font" /></div>
                <Input value={form.font} onChange={(e) => set("font", e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <div className="flex items-center justify-between"><Label>Size (pt)</Label><Cite field="size_pt" /></div>
                <Input type="number" step="0.5" value={form.size_pt} onChange={(e) => set("size_pt", Number(e.target.value))} />
              </div>
              <div className="space-y-1.5">
                <div className="flex items-center justify-between"><Label>Margins (in)</Label><Cite field="margins_in" /></div>
                <Input type="number" step="0.25" value={form.margins_in} onChange={(e) => set("margins_in", Number(e.target.value))} />
              </div>
              <div className="space-y-1.5">
                <div className="flex items-center justify-between"><Label>Line spacing</Label><Cite field="line_spacing" /></div>
                <Input type="number" step="0.1" value={form.line_spacing} onChange={(e) => set("line_spacing", Number(e.target.value))} />
              </div>
              <div className="col-span-2 space-y-1.5">
                <div className="flex items-center justify-between"><Label>Page number format</Label><Cite field="page_number_format" /></div>
                <Input value={form.page_number_format} onChange={(e) => set("page_number_format", e.target.value)} />
              </div>
              <div className="col-span-2 space-y-1.5">
                <div className="flex items-center justify-between"><Label>File name pattern</Label><Cite field="file_name_pattern" /></div>
                <Input value={form.file_name_pattern} onChange={(e) => set("file_name_pattern", e.target.value)} />
              </div>
              <div className="col-span-2 space-y-1.5">
                <div className="flex items-center justify-between"><Label>Volume page limits</Label><Cite field="volume_page_limits" /></div>
                <Textarea
                  rows={4}
                  placeholder="Volume I=50&#10;Volume II=20"
                  value={form.volume_page_limits_text}
                  onChange={(e) => set("volume_page_limits_text", e.target.value)}
                />
                <p className="text-xs text-muted-foreground">One per line: <span className="font-mono">VolumeName=MaxPages</span></p>
              </div>
              <div className="col-span-2 space-y-1.5">
                <div className="flex items-center justify-between"><Label>Notes</Label><Cite field="notes" /></div>
                <Textarea rows={2} value={form.notes} onChange={(e) => set("notes", e.target.value)} />
              </div>
            </div>

            {derive.data?.confidence != null && (
              <Badge variant="outline" className="text-[10px]">
                Confidence: {Math.round((derive.data.confidence ?? 0) * 100)}%
              </Badge>
            )}
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>Cancel</Button>
          {hasResult && (
            <>
              <Button variant="outline" onClick={run} disabled={derive.isPending || saving}>
                {derive.isPending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
                Re-extract
              </Button>
              <Button onClick={onSave} disabled={saving || create.isPending}>
                {saving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
                Save and link
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
