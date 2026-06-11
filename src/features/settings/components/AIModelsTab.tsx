import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { useAuthContext } from "@/features/auth/components/AuthProvider";

type Provider = "anthropic" | "lovable";

type Row = {
  function_name: string;
  provider: Provider;
  model: string;
  max_tokens: number | null;
};

type FnMeta = {
  name: string;
  label: string;
  description: string;
  group: string;
  defaultProvider: Provider;
  defaultModel: string;
  defaultMax: number;
};

// Mirrors MODEL_CONFIG in supabase/functions/_shared/aiClient.ts.
const FUNCTIONS: FnMeta[] = [
  // Assistant
  { name: "solicitation-assistant", label: "AI Assistant (chat)", description: "Conversational assistant in the Solicitation Assistant tab.", group: "Assistant", defaultProvider: "lovable", defaultModel: "google/gemini-2.5-pro", defaultMax: 8000 },
  { name: "generate-assistant-starters", label: "Assistant Starters", description: "Generates starter prompt cards for the assistant.", group: "Assistant", defaultProvider: "lovable", defaultModel: "google/gemini-2.5-flash", defaultMax: 1500 },
  // Analysis
  { name: "analyze-solicitation", label: "Solicitation Analysis", description: "Executive summary, key requirements, and evaluation factors.", group: "Analysis", defaultProvider: "lovable", defaultModel: "google/gemini-2.5-pro", defaultMax: 16000 },
  { name: "analyze-sections", label: "Section Analysis", description: "Per-section breakdown of the solicitation.", group: "Analysis", defaultProvider: "lovable", defaultModel: "google/gemini-2.5-pro", defaultMax: 16000 },
  { name: "analyze-gaps", label: "Capability Gap Analysis", description: "Identifies gaps between requirements and capabilities.", group: "Analysis", defaultProvider: "lovable", defaultModel: "google/gemini-2.5-pro", defaultMax: 12000 },
  { name: "identify-risks-opportunities", label: "Risks & Opportunities", description: "Detects risks and opportunities in a solicitation.", group: "Analysis", defaultProvider: "lovable", defaultModel: "google/gemini-2.5-pro", defaultMax: 16000 },
  { name: "suggest-risk-mitigation", label: "Risk Mitigations", description: "Suggests mitigations for identified risks.", group: "Analysis", defaultProvider: "lovable", defaultModel: "google/gemini-2.5-flash", defaultMax: 2000 },
  { name: "compare-solicitations", label: "Comparison", description: "Compares the current solicitation to a prior one.", group: "Analysis", defaultProvider: "anthropic", defaultModel: "claude-sonnet-4-5", defaultMax: 8192 },
  // Extraction
  { name: "extract-entities", label: "Entity Extraction", description: "Pulls dates, requirements, dollar amounts, and other entities.", group: "Extraction", defaultProvider: "lovable", defaultModel: "google/gemini-2.5-pro", defaultMax: 16000 },
  { name: "extract-requirements", label: "Requirement Extraction", description: "Extracts shall-statements and requirement items.", group: "Extraction", defaultProvider: "lovable", defaultModel: "google/gemini-2.5-flash", defaultMax: 8000 },
  { name: "extract-capabilities", label: "Capability Extraction", description: "Extracts capability statements from knowledge documents.", group: "Extraction", defaultProvider: "lovable", defaultModel: "google/gemini-2.5-pro", defaultMax: 8000 },
  { name: "reconcile-solicitation-overview", label: "Overview Auto-fill", description: "Maps extracted entities to overview fields.", group: "Extraction", defaultProvider: "lovable", defaultModel: "google/gemini-2.5-flash", defaultMax: 4000 },
  // Questions & Reports
  { name: "generate-questions", label: "Strategic Questions", description: "Generates clarifying and strategic questions.", group: "Questions & Reports", defaultProvider: "lovable", defaultModel: "google/gemini-2.5-flash", defaultMax: 32000 },
  { name: "draft-clarification-request", label: "Clarification Drafts", description: "Drafts clarification requests for the agency.", group: "Questions & Reports", defaultProvider: "lovable", defaultModel: "google/gemini-2.5-pro", defaultMax: 4000 },
  { name: "generate-report", label: "Executive Reports", description: "Builds executive and client-facing reports.", group: "Questions & Reports", defaultProvider: "lovable", defaultModel: "google/gemini-2.5-pro", defaultMax: 32000 },
  // Proposal
  { name: "generate-outline", label: "Proposal Outline", description: "Generates a proposal outline from the solicitation.", group: "Proposal", defaultProvider: "anthropic", defaultModel: "claude-sonnet-4-5", defaultMax: 16384 },
  { name: "generate-win-themes", label: "Win Themes", description: "Generates win themes and discriminators.", group: "Proposal", defaultProvider: "anthropic", defaultModel: "claude-sonnet-4-5", defaultMax: 6000 },
  { name: "draft-section", label: "Proposal Drafting", description: "Drafts proposal sections from outline, requirements, and knowledge.", group: "Proposal", defaultProvider: "anthropic", defaultModel: "claude-sonnet-4-5", defaultMax: 8000 },
  { name: "polish-section", label: "Proposal Polish", description: "Tightens, expands, rewrites to theme, or runs compliance check on a draft.", group: "Proposal", defaultProvider: "anthropic", defaultModel: "claude-sonnet-4-5", defaultMax: 6000 },
  { name: "generate-preset", label: "Lens Presets", description: "Generates analysis lens presets.", group: "Proposal", defaultProvider: "lovable", defaultModel: "openai/gpt-5", defaultMax: 8000 },
];

const GROUPS = ["Assistant", "Analysis", "Extraction", "Questions & Reports", "Proposal"];

const ANTHROPIC_MODELS = ["claude-sonnet-4-5", "claude-opus-4-5", "claude-haiku-4-5"];
const LOVABLE_MODELS = [
  "google/gemini-2.5-pro",
  "google/gemini-2.5-flash",
  "google/gemini-2.5-flash-lite",
  "google/gemini-3-flash-preview",
  "google/gemini-3.1-flash-lite-preview",
  "google/gemini-3.1-pro-preview",
  "google/gemini-3.5-flash",
  "openai/gpt-5",
  "openai/gpt-5-mini",
  "openai/gpt-5-nano",
  "openai/gpt-5.2",
  "openai/gpt-5.4",
  "openai/gpt-5.4-mini",
  "openai/gpt-5.4-pro",
  "openai/gpt-5.5",
  "openai/gpt-5.5-pro",
];

export function AIModelsTab() {
  const { user } = useAuthContext();
  const { data: orgId } = useQuery({
    queryKey: ["my-org-id", user?.id],
    enabled: !!user?.id,
    queryFn: async () => {
      const { data } = await supabase
        .from("users").select("organization_id").eq("id", user!.id).maybeSingle();
      return data?.organization_id ?? null;
    },
  });

  const { data, isLoading } = useQuery({
    queryKey: ["ai-model-settings", orgId],
    enabled: !!orgId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("ai_model_settings")
        .select("function_name, provider, model, max_tokens")
        .eq("organization_id", orgId!);
      if (error) throw error;
      return (data ?? []) as Row[];
    },
  });

  if (isLoading || !orgId) return <div className="text-muted-foreground">Loading…</div>;

  const byName = new Map<string, Row>((data ?? []).map((r) => [r.function_name, r]));

  return (
    <Card>
      <CardHeader>
        <CardTitle>AI Models</CardTitle>
        <CardDescription>
          Pick the provider and model used by each AI function. Changes apply to new requests within ~60 seconds.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-8">
        {GROUPS.map((group) => {
          const items = FUNCTIONS.filter((f) => f.group === group);
          if (items.length === 0) return null;
          return (
            <div key={group} className="space-y-3">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                {group}
              </h3>
              <div className="space-y-3">
                {items.map((fn) => (
                  <FunctionRow key={fn.name} meta={fn} current={byName.get(fn.name) ?? null} orgId={orgId} />
                ))}
              </div>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}

function FunctionRow({
  meta,
  current,
  orgId,
}: {
  meta: FnMeta;
  current: Row | null;
  orgId: string;
}) {
  const qc = useQueryClient();
  const { user } = useAuthContext();

  const baseProvider = current?.provider ?? meta.defaultProvider;
  const baseModel = current?.model ?? meta.defaultModel;
  const baseMax = current?.max_tokens ?? meta.defaultMax;

  const [provider, setProvider] = useState<Provider>(baseProvider);
  const [model, setModel] = useState<string>(baseModel);
  const [maxTokens, setMaxTokens] = useState<string>(String(baseMax));

  const modelOptions = useMemo(
    () => (provider === "anthropic" ? ANTHROPIC_MODELS : LOVABLE_MODELS),
    [provider]
  );

  const dirty =
    provider !== baseProvider ||
    model !== baseModel ||
    Number(maxTokens) !== baseMax;

  const isOverridden = !!current;
  const matchesHardcoded =
    baseProvider === meta.defaultProvider &&
    baseModel === meta.defaultModel &&
    baseMax === meta.defaultMax;

  const save = useMutation({
    mutationFn: async () => {
      const payload = {
        organization_id: orgId,
        function_name: meta.name,
        provider,
        model,
        max_tokens: maxTokens ? Number(maxTokens) : null,
        updated_at: new Date().toISOString(),
        updated_by: user?.id ?? null,
      };
      const { error } = await supabase
        .from("ai_model_settings")
        .upsert(payload, { onConflict: "organization_id,function_name" });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success(`${meta.label} updated`);
      qc.invalidateQueries({ queryKey: ["ai-model-settings"] });
    },
    onError: (e: unknown) => toast.error(e instanceof Error ? e.message : "Failed to save"),
  });

  const reset = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from("ai_model_settings")
        .delete()
        .eq("organization_id", orgId)
        .eq("function_name", meta.name);
      if (error) throw error;
    },
    onSuccess: () => {
      setProvider(meta.defaultProvider);
      setModel(meta.defaultModel);
      setMaxTokens(String(meta.defaultMax));
      toast.success(`${meta.label} reset to default`);
      qc.invalidateQueries({ queryKey: ["ai-model-settings"] });
    },
    onError: (e: unknown) => toast.error(e instanceof Error ? e.message : "Failed to reset"),
  });

  return (
    <div className="rounded-lg border p-4 space-y-3">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="font-medium flex items-center gap-2 flex-wrap">
            {meta.label}
            <Badge variant="secondary" className="font-mono text-xs">{meta.name}</Badge>
            {isOverridden && !matchesHardcoded && (
              <Badge variant="outline" className="text-xs">Overridden</Badge>
            )}
          </div>
          <p className="text-sm text-muted-foreground">{meta.description}</p>
          <p className="text-xs text-muted-foreground mt-1">
            Default: <span className="font-mono">{meta.defaultProvider} · {meta.defaultModel} · {meta.defaultMax} tok</span>
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {isOverridden && (
            <Button
              size="sm"
              variant="ghost"
              onClick={() => reset.mutate()}
              disabled={reset.isPending}
            >
              {reset.isPending ? "Resetting…" : "Reset to default"}
            </Button>
          )}
          <Button size="sm" onClick={() => save.mutate()} disabled={!dirty || save.isPending}>
            {save.isPending ? "Saving…" : "Save"}
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <div className="space-y-1">
          <Label>Provider</Label>
          <Select
            value={provider}
            onValueChange={(v) => {
              const next = v as Provider;
              setProvider(next);
              const opts = next === "anthropic" ? ANTHROPIC_MODELS : LOVABLE_MODELS;
              if (!opts.includes(model)) setModel(opts[0]);
            }}
          >
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="anthropic">Anthropic (Claude)</SelectItem>
              <SelectItem value="lovable">Lovable AI Gateway</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1">
          <Label>Model</Label>
          <Select value={model} onValueChange={setModel}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {modelOptions.map((m) => (
                <SelectItem key={m} value={m}>{m}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1">
          <Label>Max tokens</Label>
          <Input
            type="number"
            min={256}
            max={200000}
            value={maxTokens}
            onChange={(e) => setMaxTokens(e.target.value)}
          />
        </div>
      </div>
    </div>
  );
}
