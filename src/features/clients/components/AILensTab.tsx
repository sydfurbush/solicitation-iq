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
import { Switch } from "@/components/ui/switch";
import { Plus, Save, Sparkles, Trash2, Wand2, Zap } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { useClientProfile, useUpsertClientProfile } from "@/features/clients/hooks/useClientProfile";
import {
  getPreset,
  isUtilityPreset,
  UTILITY_SERVICE_CATEGORIES,
  UTILITY_DELIVERY_MODELS,
  UTILITY_ISO_RTOS,
  type LensPreset,
} from "@/features/clients/lib/lensPresets";
import { usePresets, type PresetContent } from "@/features/presets/hooks/usePresets";
import { supabase } from "@/integrations/supabase/client";

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

function MultiToggleList({ label, options, values, onChange }: {
  label: string; options: readonly string[]; values: string[]; onChange: (v: string[]) => void;
}) {
  const set = new Set(values);
  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      <div className="flex flex-wrap gap-1.5">
        {options.map((opt) => {
          const active = set.has(opt);
          return (
            <Badge
              key={opt}
              variant={active ? "default" : "outline"}
              className="cursor-pointer select-none"
              onClick={() => {
                if (active) onChange(values.filter((v) => v !== opt));
                else onChange([...values, opt]);
              }}
            >
              {opt}
            </Badge>
          );
        })}
      </div>
    </div>
  );
}

export function AILensTab({ clientId }: { clientId: string }) {
  const { data: profile, isLoading } = useClientProfile(clientId);
  const upsert = useUpsertClientProfile(clientId);

  // Federal / shared fields
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

  // Utility-supplier fields
  const [serviceCategories, setServiceCategories] = useState<string[]>([]);
  const [regulatoryBodies, setRegulatoryBodies] = useState<string[]>([]);
  const [isoRto, setIsoRto] = useState<string>("");
  const [deliveryModels, setDeliveryModels] = useState<string[]>([]);
  const [territoryStates, setTerritoryStates] = useState<string[]>([]);
  const [territoryDivisions, setTerritoryDivisions] = useState<string[]>([]);
  const [buyers, setBuyers] = useState<string[]>([]);
  const [prequalPlatforms, setPrequalPlatforms] = useState<string[]>([]);
  const [trir, setTrir] = useState<string>("");
  const [dart, setDart] = useState<string>("");
  const [emr, setEmr] = useState<string>("");
  const [mutualAid, setMutualAid] = useState<string>("");
  const [workforce, setWorkforce] = useState<{ k: string; v: string }[]>([]);
  const [diversityCerts, setDiversityCerts] = useState<string[]>([]);
  const [tierIds, setTierIds] = useState<string[]>([]);
  const [bondSingle, setBondSingle] = useState<string>("");
  const [bondAggregate, setBondAggregate] = useState<string>("");
  const [bondCoverages, setBondCoverages] = useState<string[]>([]);
  const [unions, setUnions] = useState<string[]>([]);
  const [prevailingWage, setPrevailingWage] = useState<boolean>(false);
  const [plaExperience, setPlaExperience] = useState<boolean>(false);
  const [stormGroups, setStormGroups] = useState<string[]>([]);
  const [stormSla, setStormSla] = useState<string>("");
  const [stormStaging, setStormStaging] = useState<string>("");
  const [techStack, setTechStack] = useState<{ k: string; v: string }[]>([]);

  // Toggle to show utility section even if not auto-detected.
  const [showUtilityManually, setShowUtilityManually] = useState(false);

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

    // Utility fields (typed loosely since older Supabase types may not include them yet).
    const p = profile as unknown as Record<string, unknown>;
    setServiceCategories((p.service_categories as string[]) ?? []);
    setRegulatoryBodies((p.regulatory_bodies as string[]) ?? []);
    setIsoRto((p.iso_rto as string) ?? "");
    setDeliveryModels((p.delivery_models as string[]) ?? []);
    const territory = (p.service_territory as Record<string, string[]>) ?? {};
    setTerritoryStates(territory.states ?? []);
    setTerritoryDivisions(territory.divisions ?? []);
    const br = (p.buyer_relationships as Record<string, string[]>) ?? {};
    setBuyers(br.buyers ?? []);
    setPrequalPlatforms(br.prequal_platforms ?? []);
    const sm = (p.safety_metrics as Record<string, unknown>) ?? {};
    setTrir(sm.trir != null ? String(sm.trir) : "");
    setDart(sm.dart != null ? String(sm.dart) : "");
    setEmr(sm.emr != null ? String(sm.emr) : "");
    setMutualAid((sm.mutual_aid as string) ?? "");
    const wc = (p.workforce_capacity as Record<string, string | number>) ?? {};
    setWorkforce(Object.entries(wc).map(([k, v]) => ({ k, v: String(v) })));
    const dt = (p.diversity_tiers as Record<string, string[]>) ?? {};
    setDiversityCerts(dt.certifications ?? []);
    setTierIds(dt.utility_tier_ids ?? []);
    const bd = (p.bonding as Record<string, unknown>) ?? {};
    setBondSingle((bd.single as string) ?? "");
    setBondAggregate((bd.aggregate as string) ?? "");
    setBondCoverages((bd.coverages as string[]) ?? []);
    const lp = (p.labor_posture as Record<string, unknown>) ?? {};
    setUnions((lp.unions as string[]) ?? []);
    setPrevailingWage(!!lp.prevailing_wage);
    setPlaExperience(!!lp.pla_experience);
    const sr = (p.storm_response as Record<string, unknown>) ?? {};
    setStormGroups((sr.mutual_aid_groups as string[]) ?? []);
    setStormSla((sr.sla as string) ?? "");
    setStormStaging((sr.staging as string) ?? "");
    const ts = (p.tech_stack as Record<string, string>) ?? {};
    setTechStack(Object.entries(ts).map(([k, v]) => ({ k, v })));
  }, [profile]);

  const utilityVisible = useMemo(() => {
    return (
      showUtilityManually ||
      isUtilityPreset(presetKey) ||
      serviceCategories.length > 0 ||
      regulatoryBodies.length > 0 ||
      !!isoRto ||
      deliveryModels.length > 0
    );
  }, [showUtilityManually, presetKey, serviceCategories, regulatoryBodies, isoRto, deliveryModels]);

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

    // Utility-side preset fields (federal presets leave these empty -> reset).
    setServiceCategories(p.service_categories ?? []);
    setRegulatoryBodies(p.regulatory_bodies ?? []);
    setIsoRto(p.iso_rto ?? "");
    setDeliveryModels(p.delivery_models ?? []);
    if (p.storm_response) {
      setStormGroups(p.storm_response.mutual_aid_groups ?? []);
      setStormSla(p.storm_response.sla ?? "");
      setStormStaging(p.storm_response.staging ?? "");
    }

    toast({ title: "Preset applied", description: `${p.label} — review and save.` });
  };

  const save = async () => {
    try {
      const payload: Record<string, unknown> = {
        preset_key: presetKey || null,
        naics_codes: naics, psc_codes: psc, set_asides: setAsides,
        agencies_focus: agencies, contract_vehicles: vehicles,
        compliance_frameworks: frameworks,
        discriminators: discriminators,
        acronym_glossary: Object.fromEntries(glossary.filter(g => g.k.trim()).map(g => [g.k.trim(), g.v])),
        always_flag: flags,
        tone_voice: tone, reading_level: reading,
        extra_notes: extraNotes || null,

        // Utility-supplier fields (additive — safe for federal clients)
        service_categories: serviceCategories,
        regulatory_bodies: regulatoryBodies,
        iso_rto: isoRto || null,
        delivery_models: deliveryModels,
        service_territory: {
          ...(territoryStates.length ? { states: territoryStates } : {}),
          ...(territoryDivisions.length ? { divisions: territoryDivisions } : {}),
        },
        buyer_relationships: {
          ...(buyers.length ? { buyers } : {}),
          ...(prequalPlatforms.length ? { prequal_platforms: prequalPlatforms } : {}),
        },
        safety_metrics: {
          ...(trir.trim() ? { trir: Number(trir) } : {}),
          ...(dart.trim() ? { dart: Number(dart) } : {}),
          ...(emr.trim() ? { emr: Number(emr) } : {}),
          ...(mutualAid.trim() ? { mutual_aid: mutualAid.trim() } : {}),
        },
        workforce_capacity: Object.fromEntries(
          workforce.filter((w) => w.k.trim()).map((w) => {
            const num = Number(w.v);
            return [w.k.trim(), Number.isFinite(num) && w.v.trim() !== "" ? num : w.v];
          })
        ),
        diversity_tiers: {
          ...(diversityCerts.length ? { certifications: diversityCerts } : {}),
          ...(tierIds.length ? { utility_tier_ids: tierIds } : {}),
        },
        bonding: {
          ...(bondSingle.trim() ? { single: bondSingle.trim() } : {}),
          ...(bondAggregate.trim() ? { aggregate: bondAggregate.trim() } : {}),
          ...(bondCoverages.length ? { coverages: bondCoverages } : {}),
        },
        labor_posture: {
          ...(unions.length ? { unions } : {}),
          ...(prevailingWage ? { prevailing_wage: true } : {}),
          ...(plaExperience ? { pla_experience: true } : {}),
        },
        storm_response: {
          ...(stormGroups.length ? { mutual_aid_groups: stormGroups } : {}),
          ...(stormSla.trim() ? { sla: stormSla.trim() } : {}),
          ...(stormStaging.trim() ? { staging: stormStaging.trim() } : {}),
        },
        tech_stack: Object.fromEntries(techStack.filter((t) => t.k.trim()).map((t) => [t.k.trim(), t.v])),
      };
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await upsert.mutateAsync(payload as any);
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
                    <div className="px-2 py-1 text-xs font-medium text-muted-foreground">Federal</div>
                    {LENS_PRESETS.filter((p) => p.family !== "utility").map((p) => (
                      <SelectItem key={p.key} value={p.key}>{p.label}</SelectItem>
                    ))}
                    <div className="px-2 py-1 text-xs font-medium text-muted-foreground border-t mt-1 pt-2">Utility supplier</div>
                    {LENS_PRESETS.filter((p) => p.family === "utility").map((p) => (
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
            <TagListEditor label="Agencies / buyers of focus" values={agencies} onChange={setAgencies} placeholder="VA / PG&E / NYC DEP" />
            <TagListEditor label="Contract vehicles" values={vehicles} onChange={setVehicles} placeholder="GSA MAS / MSA" />
            <TagListEditor label="Compliance frameworks" values={frameworks} onChange={setFrameworks} placeholder="HIPAA / NERC CIP / AWWA" />
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

      {/* ======================== Utility Supplier Profile ======================== */}
      <Card>
        <CardHeader className="flex flex-row items-start justify-between gap-4">
          <div>
            <CardTitle className="text-base flex items-center gap-2">
              <Zap className="h-4 w-4 text-primary" />
              Utility-supplier profile
              {utilityVisible && <Badge variant="outline" className="text-xs">active</Badge>}
            </CardTitle>
            <p className="text-sm text-muted-foreground mt-1">
              Context for clients selling into the utility industry (IOUs, munis, co-ops, ISO/RTO).
              Optional — leave empty for federal-only clients.
            </p>
          </div>
          {!utilityVisible && (
            <Button variant="outline" size="sm" onClick={() => setShowUtilityManually(true)}>
              <Plus className="mr-1 h-3.5 w-3.5" /> Add utility profile
            </Button>
          )}
        </CardHeader>
        {utilityVisible && (
          <CardContent className="space-y-6">
            <MultiToggleList
              label="Service categories (a client can be in multiple lanes)"
              options={UTILITY_SERVICE_CATEGORIES}
              values={serviceCategories}
              onChange={setServiceCategories}
            />

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <TagListEditor
                label="Regulatory bodies"
                values={regulatoryBodies}
                onChange={setRegulatoryBodies}
                placeholder="FERC / NERC RF / PHMSA / EPA Region 4"
              />
              <div className="space-y-2">
                <Label>ISO / RTO</Label>
                <Select value={isoRto || "__none"} onValueChange={(v) => setIsoRto(v === "__none" ? "" : v)}>
                  <SelectTrigger><SelectValue placeholder="None" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none">None / Multiple</SelectItem>
                    {UTILITY_ISO_RTOS.map((r) => (
                      <SelectItem key={r} value={r}>{r}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <MultiToggleList
              label="Delivery models offered"
              options={UTILITY_DELIVERY_MODELS}
              values={deliveryModels}
              onChange={setDeliveryModels}
            />

            <Separator />

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <TagListEditor label="Service territory — states" values={territoryStates} onChange={setTerritoryStates} placeholder="TX" />
              <TagListEditor label="Service territory — operating divisions" values={territoryDivisions} onChange={setTerritoryDivisions} placeholder="Gulf Coast Region" />
              <TagListEditor label="Known buyers / current MSAs" values={buyers} onChange={setBuyers} placeholder="Duke Energy / NYC DEP" />
              <TagListEditor label="Prequal platforms held" values={prequalPlatforms} onChange={setPrequalPlatforms} placeholder="ISN / Avetta / Veriforce / Browz" />
            </div>

            <Separator />

            <div className="space-y-2">
              <Label>Safety metrics</Label>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                <Input placeholder="TRIR" value={trir} onChange={(e) => setTrir(e.target.value)} />
                <Input placeholder="DART" value={dart} onChange={(e) => setDart(e.target.value)} />
                <Input placeholder="EMR" value={emr} onChange={(e) => setEmr(e.target.value)} />
                <Input placeholder="Mutual-aid history" value={mutualAid} onChange={(e) => setMutualAid(e.target.value)} />
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>Workforce & capacity</Label>
                <Button size="sm" variant="outline" onClick={() => setWorkforce([...workforce, { k: "", v: "" }])}>
                  <Plus className="mr-1 h-3.5 w-3.5" /> Add
                </Button>
              </div>
              {workforce.length === 0 && (
                <p className="text-xs text-muted-foreground">e.g. line_crews_distribution=12, bucket_trucks=8, PEs_civil=4, OQ_qualified=80</p>
              )}
              {workforce.map((w, i) => (
                <div key={i} className="grid grid-cols-12 gap-2">
                  <Input className="col-span-5" placeholder="key (e.g. line_crews_T)" value={w.k} onChange={(e) => setWorkforce(workforce.map((x, idx) => idx === i ? { ...x, k: e.target.value } : x))} />
                  <Input className="col-span-6" placeholder="value" value={w.v} onChange={(e) => setWorkforce(workforce.map((x, idx) => idx === i ? { ...x, v: e.target.value } : x))} />
                  <Button variant="ghost" size="icon" className="col-span-1" onClick={() => setWorkforce(workforce.filter((_, idx) => idx !== i))}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </div>

            <Separator />

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <TagListEditor label="Diversity certifications" values={diversityCerts} onChange={setDiversityCerts} placeholder="MBE / WBE / DBE / SDVOSB" />
              <TagListEditor label="Utility supplier tier IDs" values={tierIds} onChange={setTierIds} placeholder="PG&E Tier 1 #12345" />
            </div>

            <div className="space-y-2">
              <Label>Bonding & insurance</Label>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                <Input placeholder="Single project bonding (e.g. $25M)" value={bondSingle} onChange={(e) => setBondSingle(e.target.value)} />
                <Input placeholder="Aggregate bonding (e.g. $100M)" value={bondAggregate} onChange={(e) => setBondAggregate(e.target.value)} />
              </div>
              <TagListEditor label="Coverages" values={bondCoverages} onChange={setBondCoverages} placeholder="GL / Auto / Umbrella / Cyber / E&O / Pollution" />
            </div>

            <div className="space-y-2">
              <Label>Labor posture</Label>
              <TagListEditor label="Union locals" values={unions} onChange={setUnions} placeholder="IBEW 1245 / UA 250 / LiUNA 872" />
              <div className="flex items-center gap-6 pt-2">
                <div className="flex items-center gap-2">
                  <Switch checked={prevailingWage} onCheckedChange={setPrevailingWage} />
                  <Label className="cursor-pointer">Prevailing-wage experience</Label>
                </div>
                <div className="flex items-center gap-2">
                  <Switch checked={plaExperience} onCheckedChange={setPlaExperience} />
                  <Label className="cursor-pointer">PLA experience</Label>
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <Label>Storm / emergency response</Label>
              <TagListEditor label="Mutual-aid groups" values={stormGroups} onChange={setStormGroups} placeholder="RMAG / SMAG / EEI / WRMAG" />
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                <Input placeholder="Mobilization SLA (e.g. 24h)" value={stormSla} onChange={(e) => setStormSla(e.target.value)} />
                <Input placeholder="Staging capacity / yards" value={stormStaging} onChange={(e) => setStormStaging(e.target.value)} />
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>Tech stack (used or supported)</Label>
                <Button size="sm" variant="outline" onClick={() => setTechStack([...techStack, { k: "", v: "" }])}>
                  <Plus className="mr-1 h-3.5 w-3.5" /> Add
                </Button>
              </div>
              {techStack.length === 0 && (
                <p className="text-xs text-muted-foreground">e.g. GIS=Esri, ADMS=Schneider EMS, AMI=Itron, WMS=Click</p>
              )}
              {techStack.map((t, i) => (
                <div key={i} className="grid grid-cols-12 gap-2">
                  <Input className="col-span-4" placeholder="category" value={t.k} onChange={(e) => setTechStack(techStack.map((x, idx) => idx === i ? { ...x, k: e.target.value } : x))} />
                  <Input className="col-span-7" placeholder="vendor / product" value={t.v} onChange={(e) => setTechStack(techStack.map((x, idx) => idx === i ? { ...x, v: e.target.value } : x))} />
                  <Button variant="ghost" size="icon" className="col-span-1" onClick={() => setTechStack(techStack.filter((_, idx) => idx !== i))}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </div>
          </CardContent>
        )}
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
