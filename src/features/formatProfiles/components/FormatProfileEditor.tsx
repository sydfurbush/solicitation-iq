import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  useCreateFormatProfile,
  useUpdateFormatProfile,
  type FormatProfile,
} from "@/features/formatProfiles/hooks/useFormatProfiles";

interface Props {
  profile: FormatProfile | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface FormState {
  name: string;
  vertical: string;
  font: string;
  size_pt: number;
  margins_in: number;
  line_spacing: number;
  page_number_format: string;
  file_name_pattern: string;
  header_html: string;
  footer_html: string;
  notes: string;
  is_default: boolean;
  volume_page_limits_text: string;
}

const DEFAULTS: FormState = {
  name: "",
  vertical: "federal",
  font: "Times New Roman",
  size_pt: 12,
  margins_in: 1,
  line_spacing: 1,
  page_number_format: "{volume} - {page} of {pages}",
  file_name_pattern: "{firm}_{solnumber}_{volume}",
  header_html: "",
  footer_html: "",
  notes: "",
  is_default: false,
  volume_page_limits_text: "",
};

function limitsToText(json: unknown): string {
  if (!json || typeof json !== "object") return "";
  return Object.entries(json as Record<string, number>)
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

export function FormatProfileEditor({ profile, open, onOpenChange }: Props) {
  const create = useCreateFormatProfile();
  const update = useUpdateFormatProfile();
  const [form, setForm] = useState<FormState>(DEFAULTS);

  useEffect(() => {
    if (profile) {
      setForm({
        name: profile.name,
        vertical: profile.vertical,
        font: profile.font,
        size_pt: profile.size_pt,
        margins_in: profile.margins_in,
        line_spacing: profile.line_spacing,
        page_number_format: profile.page_number_format,
        file_name_pattern: profile.file_name_pattern,
        header_html: profile.header_html ?? "",
        footer_html: profile.footer_html ?? "",
        notes: profile.notes ?? "",
        is_default: profile.is_default,
        volume_page_limits_text: limitsToText(profile.volume_page_limits),
      });
    } else {
      setForm(DEFAULTS);
    }
  }, [profile, open]);

  const set = <K extends keyof FormState>(k: K, v: FormState[K]) =>
    setForm((f) => ({ ...f, [k]: v }));

  const onSave = async () => {
    if (!form.name.trim()) {
      toast.error("Name is required");
      return;
    }
    const patch = {
      name: form.name.trim(),
      vertical: form.vertical,
      font: form.font,
      size_pt: Number(form.size_pt),
      margins_in: Number(form.margins_in),
      line_spacing: Number(form.line_spacing),
      page_number_format: form.page_number_format,
      file_name_pattern: form.file_name_pattern,
      header_html: form.header_html || null,
      footer_html: form.footer_html || null,
      notes: form.notes || null,
      is_default: form.is_default,
      volume_page_limits: parseLimits(form.volume_page_limits_text),
    };
    try {
      if (profile) {
        await update.mutateAsync({ id: profile.id, patch });
        toast.success("Profile updated");
      } else {
        await create.mutateAsync(patch);
        toast.success("Profile created");
      }
      onOpenChange(false);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Save failed");
    }
  };

  const pending = create.isPending || update.isPending;
  const samplePage = form.page_number_format
    .replace("{volume}", "Volume I")
    .replace("{page}", "3")
    .replace("{pages}", "42");
  const sampleFile = form.file_name_pattern
    .replace("{firm}", "Acme")
    .replace("{solnumber}", "RFP-2026-001")
    .replace("{volume}", "Volume_I");

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{profile ? "Edit format profile" : "New format profile"}</DialogTitle>
        </DialogHeader>

        <div className="grid grid-cols-2 gap-3">
          <div className="col-span-2 space-y-1.5">
            <Label>Name</Label>
            <Input value={form.name} onChange={(e) => set("name", e.target.value)} placeholder="e.g. DoD federal" />
          </div>

          <div className="space-y-1.5">
            <Label>Vertical</Label>
            <Select value={form.vertical} onValueChange={(v) => set("vertical", v)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="federal">Federal</SelectItem>
                <SelectItem value="utility">Utility</SelectItem>
                <SelectItem value="commercial">Commercial</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label>Font</Label>
            <Input value={form.font} onChange={(e) => set("font", e.target.value)} />
          </div>

          <div className="space-y-1.5">
            <Label>Size (pt)</Label>
            <Input type="number" step="0.5" value={form.size_pt} onChange={(e) => set("size_pt", Number(e.target.value))} />
          </div>

          <div className="space-y-1.5">
            <Label>Margins (in)</Label>
            <Input type="number" step="0.25" value={form.margins_in} onChange={(e) => set("margins_in", Number(e.target.value))} />
          </div>

          <div className="space-y-1.5">
            <Label>Line spacing</Label>
            <Input type="number" step="0.1" value={form.line_spacing} onChange={(e) => set("line_spacing", Number(e.target.value))} />
          </div>

          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <Label>Set as default for vertical</Label>
              <Switch checked={form.is_default} onCheckedChange={(v) => set("is_default", v)} />
            </div>
            <p className="text-xs text-muted-foreground">Used by compile when no profile is selected for a solicitation.</p>
          </div>

          <div className="col-span-2 space-y-1.5">
            <Label>Page number format</Label>
            <Input value={form.page_number_format} onChange={(e) => set("page_number_format", e.target.value)} />
            <p className="text-xs text-muted-foreground">Tokens: {"{volume} {page} {pages}"} · Preview: <span className="font-mono">{samplePage}</span></p>
          </div>

          <div className="col-span-2 space-y-1.5">
            <Label>File name pattern</Label>
            <Input value={form.file_name_pattern} onChange={(e) => set("file_name_pattern", e.target.value)} />
            <p className="text-xs text-muted-foreground">Tokens: {"{firm} {solnumber} {volume}"} · Preview: <span className="font-mono">{sampleFile}.docx</span></p>
          </div>

          <div className="col-span-2 space-y-1.5">
            <Label>Volume page limits</Label>
            <Textarea
              rows={3}
              placeholder="Volume I=50&#10;Volume II=20"
              value={form.volume_page_limits_text}
              onChange={(e) => set("volume_page_limits_text", e.target.value)}
            />
            <p className="text-xs text-muted-foreground">One per line: <span className="font-mono">VolumeName=MaxPages</span></p>
          </div>

          <div className="col-span-2 space-y-1.5">
            <Label>Header HTML (optional)</Label>
            <Textarea rows={2} value={form.header_html} onChange={(e) => set("header_html", e.target.value)} />
          </div>

          <div className="col-span-2 space-y-1.5">
            <Label>Footer HTML (optional)</Label>
            <Textarea rows={2} value={form.footer_html} onChange={(e) => set("footer_html", e.target.value)} />
          </div>

          <div className="col-span-2 space-y-1.5">
            <Label>Notes</Label>
            <Textarea rows={2} value={form.notes} onChange={(e) => set("notes", e.target.value)} />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={pending}>Cancel</Button>
          <Button onClick={onSave} disabled={pending}>{profile ? "Save" : "Create"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
