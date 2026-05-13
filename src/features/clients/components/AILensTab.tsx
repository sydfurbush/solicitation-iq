import { useEffect, useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { Plus, Save, Sparkles, Trash2, Wand2 } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { useClientProfile, useUpsertClientProfile } from "@/features/clients/hooks/useClientProfile";
import { LENS_PRESETS, getPreset } from "@/features/clients/lib/lensPresets";

interface Discriminator { title: string; evidence: string; proof_point: string }
interface FlagRule { rule: string; reason: string }

const TONE_OPTIONS = [
  { v: "formal", label: "Formal" },
  { v: "consultative", label: "Consultative" },
  { v: "technical", label: "Technical" },
  { v: "plain", label: "Plain language" },
];

function TagListEditor({ label, values, onChange, placeholder }: {
  label: string; values: string[]; onChange: (v: string[]) => void; placeholder?: string;
}) {
  const [draft, setDraft] = useState("");
  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      <div className="flex flex-wrap gap-1.5">
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
        <Button
          type="button" variant="outline" size="icon"
          onClick={() => { if (draft.trim()) { onChange([...values, draft.trim()]); setDraft(""); } }}
        >
          <Plus className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}

export function AILensTab({ clientId }: { clientId: string }) {
  const { data: profile, isLoading } = useClientProfile(clientId);
  const upsert = useUpsertClientProfile(clientId);

  const [presetKey, setPresetKey] = useState<string>("");
  const [naics, setNaics] = useState<string[]>([]);
  const [psc, setPsc] = useState<string[]>([]);
  const [setAsides, setSetAsides] = useState<string[]>([]);
  const [agencies, setAgencies] = useState<string[]>([]);
  const [vehicles, setVehicles] = useState<string[]>([]);
  const [frameworks, setFrameworks] = useState<string[]>([]);
  const [discriminators, setDiscriminators] = useState<Discriminator[]>([]);
  const [glossary, setGlossary] = useState<{ k: string; v: string }[]>([]);
  const [flags, setFlags] = useState<FlagRule[]>([]);
  const [tone, setTone] = useState("consultative");
  const [reading, setReading] = useState(12);
  const [extraNotes, setExtraNotes] = useState("");

  useEffect(() => {
    if (!profile) return;
    setPresetKey(profile.preset_key ?? "");
    setNaics(profile.naics_codes ?? []);
    setPsc(profile.psc_codes ?? []);
    setSetAsides(profile.set_asides ?? []);
    setAgencies(profile.agencies_focus ?? []);
    setVehicles(profile.contract_vehicles ?? []);
    setFrameworks(profile.compliance_frameworks ?? []);
    setDiscriminators(((profile.discriminators as unknown) as Discriminator[]) ?? []);
    const g = (profile.acronym_glossary as Record<string, string>) ?? {};
    setGlossary(Object.entries(g).map(([k, v]) => ({ k, v })));
    setFlags(((profile.always_flag as unknown) as FlagRule[]) ?? []);
    setTone(profile.tone_voice ?? "consultative");
    setReading(profile.reading_level ?? 12);
    setExtraNotes(profile.extra_notes ?? "");
  }, [profile]);

  const applyPreset = (key: string) => {
    const p = getPreset(key);
    if (!p) return;
    setPresetKey(key);
    setNaics(p.naics_codes); setPsc(p.psc_codes); setSetAsides(p.set_asides);
    setAgencies(p.agencies_focus); setVehicles(p.contract_vehicles);
    setFrameworks(p.compliance_frameworks);
    setDiscriminators(p.discriminators);
    setGlossary(Object.entries(p.acronym_glossary).map(([k, v]) => ({ k, v })));
    setFlags(p.always_flag);
    setTone(p.tone_voice); setReading(p.reading_level);
    toast({ title: "Preset applied", description: `${p.label} — review and save.` });
  };

  const save = async () => {
    try {
      await upsert.mutateAsync({
        preset_key: presetKey || null,
        naics_codes: naics, psc_codes: psc, set_asides: setAsides,
        agencies_focus: agencies, contract_vehicles: vehicles,
        compliance_frameworks: frameworks,
        discriminators: discriminators as any,
        acronym_glossary: Object.fromEntries(glossary.filter(g => g.k.trim()).map(g => [g.k.trim(), g.v])) as any,
        always_flag: flags as any,
        tone_voice: tone, reading_level: reading,
        extra_notes: extraNotes || null,
      });
      toast({ title: "AI Lens saved", description: "All future AI analyses will use this lens." });
    } catch (e) {
      toast({ title: "Save failed", description: e instanceof Error ? e.message : String(e), variant: "destructive" });
    }
  };

  if (isLoading) return <Card><CardContent className="py-8 text-sm text-muted-foreground">Loading lens…</CardContent></Card>;

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="flex flex-row items-start justify-between gap-4">
          <div>
            <CardTitle className="text-base flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-primary" /> AI Lens
              {profile?.version ? <Badge variant="outline">v{profile.version}</Badge> : null}
            </CardTitle>
            <p className="text-sm text-muted-foreground mt-1">
              Context the AI uses for every analysis on this client's solicitations.
            </p>
          </div>
          <Button onClick={save} disabled={upsert.isPending}>
            <Save className="mr-2 h-4 w-4" /> Save lens
          </Button>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Preset</Label>
              <div className="flex gap-2">
                <Select value={presetKey || "none"} onValueChange={(v) => v !== "none" && applyPreset(v)}>
                  <SelectTrigger><SelectValue placeholder="Choose a starter preset" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">None (custom)</SelectItem>
                    {LENS_PRESETS.map(p => (
                      <SelectItem key={p.key} value={p.key}>{p.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {presetKey && (
                  <Button variant="outline" size="icon" onClick={() => applyPreset(presetKey)} title="Re-apply preset">
                    <Wand2 className="h-4 w-4" />
                  </Button>
                )}
              </div>
              {presetKey && <p className="text-xs text-muted-foreground">{getPreset(presetKey)?.description}</p>}
            </div>
            <div className="space-y-2">
              <Label>Voice</Label>
              <Select value={tone} onValueChange={setTone}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{TONE_OPTIONS.map(o => <SelectItem key={o.v} value={o.v}>{o.label}</SelectItem>)}</SelectContent>
              </Select>
              <div className="pt-2">
                <Label className="text-xs text-muted-foreground">Reading level (grade): {reading}</Label>
                <Slider value={[reading]} min={8} max={16} step={1} onValueChange={(v) => setReading(v[0])} />
              </div>
            </div>
          </div>

          <Separator />

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <TagListEditor label="NAICS codes" values={naics} onChange={setNaics} placeholder="541512" />
            <TagListEditor label="PSC codes" values={psc} onChange={setPsc} placeholder="DA01" />
            <TagListEditor label="Set-asides" values={setAsides} onChange={setSetAsides} placeholder="8(a)" />
            <TagListEditor label="Agencies of focus" values={agencies} onChange={setAgencies} placeholder="VA" />
            <TagListEditor label="Contract vehicles" values={vehicles} onChange={setVehicles} placeholder="GSA MAS" />
            <TagListEditor label="Compliance frameworks" values={frameworks} onChange={setFrameworks} placeholder="HIPAA" />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-base">Discriminators</CardTitle>
          <Button size="sm" variant="outline" onClick={() => setDiscriminators([...discriminators, { title: "", evidence: "", proof_point: "" }])}>
            <Plus className="mr-1 h-3.5 w-3.5" /> Add
          </Button>
        </CardHeader>
        <CardContent className="space-y-3">
          {discriminators.length === 0 && <p className="text-sm text-muted-foreground">None yet — these are the win-themes the AI will weave into outputs.</p>}
          {discriminators.map((d, i) => (
            <div key={i} className="grid grid-cols-1 md:grid-cols-12 gap-2 p-3 border rounded-md">
              <Input className="md:col-span-3" placeholder="Title" value={d.title} onChange={(e) => setDiscriminators(discriminators.map((x, idx) => idx === i ? { ...x, title: e.target.value } : x))} />
              <Input className="md:col-span-4" placeholder="Evidence" value={d.evidence} onChange={(e) => setDiscriminators(discriminators.map((x, idx) => idx === i ? { ...x, evidence: e.target.value } : x))} />
              <Input className="md:col-span-4" placeholder="Proof point" value={d.proof_point} onChange={(e) => setDiscriminators(discriminators.map((x, idx) => idx === i ? { ...x, proof_point: e.target.value } : x))} />
              <Button variant="ghost" size="icon" className="md:col-span-1" onClick={() => setDiscriminators(discriminators.filter((_, idx) => idx !== i))}>
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-base">Always-flag rules</CardTitle>
          <Button size="sm" variant="outline" onClick={() => setFlags([...flags, { rule: "", reason: "" }])}>
            <Plus className="mr-1 h-3.5 w-3.5" /> Add
          </Button>
        </CardHeader>
        <CardContent className="space-y-3">
          {flags.length === 0 && <p className="text-sm text-muted-foreground">Conditions the AI must surface as a risk on every solicitation.</p>}
          {flags.map((f, i) => (
            <div key={i} className="grid grid-cols-1 md:grid-cols-12 gap-2 p-3 border rounded-md">
              <Input className="md:col-span-5" placeholder="Rule (e.g. LPTA evaluation)" value={f.rule} onChange={(e) => setFlags(flags.map((x, idx) => idx === i ? { ...x, rule: e.target.value } : x))} />
              <Input className="md:col-span-6" placeholder="Why it matters" value={f.reason} onChange={(e) => setFlags(flags.map((x, idx) => idx === i ? { ...x, reason: e.target.value } : x))} />
              <Button variant="ghost" size="icon" className="md:col-span-1" onClick={() => setFlags(flags.filter((_, idx) => idx !== i))}>
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-base">Acronym glossary</CardTitle>
          <Button size="sm" variant="outline" onClick={() => setGlossary([...glossary, { k: "", v: "" }])}>
            <Plus className="mr-1 h-3.5 w-3.5" /> Add
          </Button>
        </CardHeader>
        <CardContent className="space-y-3">
          {glossary.length === 0 && <p className="text-sm text-muted-foreground">Domain acronyms the AI should expand and interpret correctly.</p>}
          {glossary.map((g, i) => (
            <div key={i} className="grid grid-cols-1 md:grid-cols-12 gap-2">
              <Input className="md:col-span-3" placeholder="Acronym" value={g.k} onChange={(e) => setGlossary(glossary.map((x, idx) => idx === i ? { ...x, k: e.target.value } : x))} />
              <Input className="md:col-span-8" placeholder="Definition" value={g.v} onChange={(e) => setGlossary(glossary.map((x, idx) => idx === i ? { ...x, v: e.target.value } : x))} />
              <Button variant="ghost" size="icon" className="md:col-span-1" onClick={() => setGlossary(glossary.filter((_, idx) => idx !== i))}>
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">Additional context</CardTitle></CardHeader>
        <CardContent>
          <Textarea
            rows={5}
            value={extraNotes}
            onChange={(e) => setExtraNotes(e.target.value)}
            placeholder="Anything else the AI should know — recent wins, leadership priorities, capacity constraints, current teaming partners..."
          />
        </CardContent>
      </Card>

      <div className="flex justify-end">
        <Button onClick={save} disabled={upsert.isPending}>
          <Save className="mr-2 h-4 w-4" /> Save lens
        </Button>
      </div>
    </div>
  );
}
