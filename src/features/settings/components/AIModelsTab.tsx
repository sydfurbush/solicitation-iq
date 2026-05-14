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

const FUNCTIONS: { name: string; label: string; description: string; defaultMax: number }[] = [
  { name: "analyze-solicitation", label: "Solicitation Analysis", description: "Executive summary, key requirements, and evaluation factors.", defaultMax: 8192 },
  { name: "identify-risks-opportunities", label: "Risks & Opportunities", description: "Detects risks and opportunities in a solicitation.", defaultMax: 8192 },
  { name: "generate-questions", label: "Strategic Questions", description: "Generates clarifying and strategic questions.", defaultMax: 8192 },
  { name: "generate-report", label: "Reports", description: "Builds executive and client-facing reports.", defaultMax: 16384 },
  { name: "compare-solicitations", label: "Comparison", description: "Compares the current solicitation to a prior one.", defaultMax: 8192 },
  { name: "extract-entities", label: "Entity Extraction", description: "Pulls dates, requirements, dollar amounts, and other entities from documents.", defaultMax: 16000 },
  { name: "reconcile-solicitation-overview", label: "Overview Auto-fill", description: "Maps extracted entities to overview fields (dates, value, agency, set-aside).", defaultMax: 4000 },
];

const ANTHROPIC_MODELS = ["claude-sonnet-4-5", "claude-opus-4-5", "claude-haiku-4-5"];
const LOVABLE_MODELS = [
  "google/gemini-2.5-pro",
  "google/gemini-2.5-flash",
  "google/gemini-3-flash-preview",
  "openai/gpt-5",
  "openai/gpt-5-mini",
  "openai/gpt-5.2",
];

export function AIModelsTab() {
  const { data, isLoading } = useQuery({
    queryKey: ["ai-model-settings"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("ai_model_settings")
        .select("function_name, provider, model, max_tokens");
      if (error) throw error;
      return (data ?? []) as Row[];
    },
  });

  if (isLoading) return <div className="text-muted-foreground">Loading…</div>;

  const byName = new Map<string, Row>((data ?? []).map((r) => [r.function_name, r]));

  return (
    <Card>
      <CardHeader>
        <CardTitle>AI Models</CardTitle>
        <CardDescription>
          Pick the provider and model used by each AI function. Changes apply to new requests within ~60 seconds.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {FUNCTIONS.map((fn) => (
          <FunctionRow key={fn.name} meta={fn} current={byName.get(fn.name) ?? null} />
        ))}
      </CardContent>
    </Card>
  );
}

function FunctionRow({
  meta,
  current,
}: {
  meta: { name: string; label: string; description: string; defaultMax: number };
  current: Row | null;
}) {
  const qc = useQueryClient();
  const { user } = useAuthContext();

  const [provider, setProvider] = useState<Provider>(current?.provider ?? "anthropic");
  const [model, setModel] = useState<string>(current?.model ?? "claude-sonnet-4-5");
  const [maxTokens, setMaxTokens] = useState<string>(String(current?.max_tokens ?? meta.defaultMax));

  const modelOptions = useMemo(
    () => (provider === "anthropic" ? ANTHROPIC_MODELS : LOVABLE_MODELS),
    [provider]
  );

  const dirty =
    provider !== (current?.provider ?? "anthropic") ||
    model !== (current?.model ?? "claude-sonnet-4-5") ||
    Number(maxTokens) !== (current?.max_tokens ?? meta.defaultMax);

  const save = useMutation({
    mutationFn: async () => {
      const payload = {
        function_name: meta.name,
        provider,
        model,
        max_tokens: maxTokens ? Number(maxTokens) : null,
        updated_at: new Date().toISOString(),
        updated_by: user?.id ?? null,
      };
      const { error } = await supabase
        .from("ai_model_settings")
        .upsert(payload, { onConflict: "function_name" });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success(`${meta.label} updated`);
      qc.invalidateQueries({ queryKey: ["ai-model-settings"] });
    },
    onError: (e: unknown) => toast.error(e instanceof Error ? e.message : "Failed to save"),
  });

  return (
    <div className="rounded-lg border p-4 space-y-3">
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="font-medium flex items-center gap-2">
            {meta.label}
            <Badge variant="secondary" className="font-mono text-xs">{meta.name}</Badge>
          </div>
          <p className="text-sm text-muted-foreground">{meta.description}</p>
        </div>
        <Button size="sm" onClick={() => save.mutate()} disabled={!dirty || save.isPending}>
          {save.isPending ? "Saving…" : "Save"}
        </Button>
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
            max={32000}
            value={maxTokens}
            onChange={(e) => setMaxTokens(e.target.value)}
          />
        </div>
      </div>
    </div>
  );
}
