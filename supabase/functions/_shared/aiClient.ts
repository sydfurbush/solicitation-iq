// Shared AI client. Per-function MODEL_CONFIG controls provider & model.
// Edit MODEL_CONFIG below to change which model a function uses.

export type Provider = "anthropic" | "lovable";

export interface ModelChoice {
  provider: Provider;
  model: string;
  maxTokens?: number;
}

// Single source of truth — change values here to retune any function.
export const MODEL_CONFIG: Record<string, ModelChoice> = {
  "analyze-solicitation": { provider: "lovable", model: "google/gemini-2.5-pro", maxTokens: 16000 },
  "identify-risks-opportunities": { provider: "lovable", model: "google/gemini-2.5-pro", maxTokens: 16000 },
  "generate-questions": { provider: "lovable", model: "google/gemini-2.5-flash", maxTokens: 32000 },
  "generate-report": { provider: "lovable", model: "google/gemini-2.5-pro", maxTokens: 32000 },
  "compare-solicitations": { provider: "anthropic", model: "claude-sonnet-4-5", maxTokens: 8192 },
  "extract-entities": { provider: "lovable", model: "google/gemini-2.5-pro", maxTokens: 16000 },
  "extract-requirements": { provider: "lovable", model: "google/gemini-2.5-flash", maxTokens: 8000 },
  "analyze-sections": { provider: "lovable", model: "google/gemini-2.5-pro", maxTokens: 16000 },
  "analyze-gaps": { provider: "lovable", model: "google/gemini-2.5-pro", maxTokens: 12000 },
  "generate-outline": { provider: "anthropic", model: "claude-sonnet-4-5", maxTokens: 16384 },
  "generate-win-themes": { provider: "anthropic", model: "claude-sonnet-4-5", maxTokens: 6000 },
  "draft-section": { provider: "anthropic", model: "claude-sonnet-4-5", maxTokens: 8000 },
  "polish-section": { provider: "anthropic", model: "claude-sonnet-4-5", maxTokens: 6000 },
  "generate-preset": { provider: "lovable", model: "openai/gpt-5", maxTokens: 8000 },
  "draft-clarification-request": { provider: "lovable", model: "google/gemini-2.5-pro", maxTokens: 4000 },
  "reconcile-solicitation-overview": { provider: "lovable", model: "google/gemini-2.5-flash", maxTokens: 4000 },
  "suggest-risk-mitigation": { provider: "lovable", model: "google/gemini-2.5-flash", maxTokens: 2000 },
  "extract-capabilities": { provider: "lovable", model: "google/gemini-2.5-pro", maxTokens: 8000 },
  "solicitation-assistant": { provider: "lovable", model: "google/gemini-2.5-pro", maxTokens: 16000 },
  "generate-assistant-starters": { provider: "lovable", model: "google/gemini-2.5-flash", maxTokens: 1500 },
};

export interface OpenAIToolSchema {
  name: string;
  description?: string;
  parameters: Record<string, unknown>; // JSON Schema
}

export interface CallAiArgs {
  functionName: string;
  system: string;
  user: string;
  tool: OpenAIToolSchema; // forced structured output
  modelOverride?: ModelChoice; // bypass MODEL_CONFIG and DB override for this call
  /** Optional image URLs (signed or public) to attach to the user turn (Lovable provider only). */
  images?: Array<{ url: string }>;
}

export class AiHttpError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

const ANTHROPIC_KEY = Deno.env.get("ANTHROPIC_API_KEY") ?? "";
const LOVABLE_KEY = Deno.env.get("LOVABLE_API_KEY") ?? "";
const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

const TTL_MS = 60_000;
const cache = new Map<string, { value: ModelChoice; expiresAt: number }>();

async function loadOverride(functionName: string): Promise<ModelChoice | null> {
  const cached = cache.get(functionName);
  if (cached && cached.expiresAt > Date.now()) return cached.value;
  if (!SUPABASE_URL || !SERVICE_KEY) return null;
  try {
    const url = `${SUPABASE_URL}/rest/v1/ai_model_settings?function_name=eq.${encodeURIComponent(functionName)}&select=provider,model,max_tokens`;
    const res = await fetch(url, {
      headers: { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}` },
    });
    if (!res.ok) return null;
    const rows = await res.json();
    const row = Array.isArray(rows) && rows[0];
    if (!row) return null;
    const value: ModelChoice = {
      provider: row.provider as Provider,
      model: row.model as string,
      maxTokens: row.max_tokens ?? undefined,
    };
    cache.set(functionName, { value, expiresAt: Date.now() + TTL_MS });
    return value;
  } catch (e) {
    console.warn("[aiClient] override fetch failed", e);
    return null;
  }
}

export async function callAiTool(args: CallAiArgs): Promise<Record<string, unknown>> {
  const fallback = MODEL_CONFIG[args.functionName];
  const override = args.modelOverride ? null : await loadOverride(args.functionName);
  const choice = args.modelOverride ?? override ?? fallback;
  if (!choice) throw new Error(`No model configured for ${args.functionName}`);
  const source = args.modelOverride ? "call-override" : override ? "db-override" : "code-fallback";
  console.log(
    `[aiClient] resolved ${args.functionName} -> provider=${choice.provider} model=${choice.model} maxTokens=${choice.maxTokens} source=${source}`
  );

  if (choice.provider === "anthropic") return callAnthropic(choice, args);
  return callLovable(choice, args);
}

async function callAnthropic(choice: ModelChoice, args: CallAiArgs): Promise<Record<string, unknown>> {
  if (!ANTHROPIC_KEY) throw new AiHttpError(500, "ANTHROPIC_API_KEY not configured");

  const body = {
    model: choice.model,
    max_tokens: choice.maxTokens ?? 4096,
    system: args.system,
    messages: [{ role: "user", content: args.user }],
    tools: [{
      name: args.tool.name,
      description: args.tool.description ?? "",
      input_schema: args.tool.parameters,
    }],
    tool_choice: { type: "tool", name: args.tool.name },
  };

  const MAX_ATTEMPTS = 4;
  let res!: Response;
  let text = "";
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": ANTHROPIC_KEY,
        "anthropic-version": "2023-06-01",
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });
    if (res.ok) break;
    text = await res.text();
    const transient =
      res.status === 503 ||
      res.status === 529 ||
      (res.status === 500 && /overloaded_error|temporarily unavailable/i.test(text));
    if (!transient || attempt === MAX_ATTEMPTS) break;
    const wait = Math.min(8000, 500 * 2 ** (attempt - 1)) + Math.floor(Math.random() * 250);
    console.warn(`[aiClient] anthropic ${res.status} transient, retrying in ${wait}ms (attempt ${attempt}/${MAX_ATTEMPTS - 1})`);
    await new Promise((r) => setTimeout(r, wait));
  }

  if (!res.ok) {
    console.error("[aiClient] anthropic error", res.status, text);
    if (res.status === 401) throw new AiHttpError(401, "Anthropic API key invalid");
    if (res.status === 429) throw new AiHttpError(429, "Anthropic rate limit exceeded. Try again later.");
    if (res.status === 402 || res.status === 403) throw new AiHttpError(402, "Anthropic credits/permission issue. Check your account.");
    if (res.status === 503 || res.status === 529) throw new AiHttpError(503, "Anthropic is temporarily overloaded. Please retry in a moment.");
    throw new AiHttpError(res.status, `Anthropic request failed: ${text}`);
  }

  const json = await res.json();
  console.log(`[aiClient] anthropic stop_reason=${json.stop_reason} model=${choice.model}`);
  const toolUse = (json.content ?? []).find((c: { type: string }) => c.type === "tool_use");
  if (!toolUse?.input) throw new Error("AI did not return structured tool_use output");
  if (json.stop_reason === "max_tokens") {
    throw new AiHttpError(
      502,
      `AI response truncated by token limit (model=${choice.model}, max_tokens=${choice.maxTokens ?? 4096}). Raise max_tokens for this function in AI Models settings, or switch to a roomier model.`,
    );
  }
  return toolUse.input as Record<string, unknown>;
}

async function callLovable(choice: ModelChoice, args: CallAiArgs): Promise<Record<string, unknown>> {
  if (!LOVABLE_KEY) throw new AiHttpError(500, "LOVABLE_API_KEY not configured");

  const userContent = args.images && args.images.length > 0
    ? [
        { type: "text", text: args.user },
        ...args.images.map((img) => ({ type: "image_url", image_url: { url: img.url } })),
      ]
    : args.user;

  const body = JSON.stringify({
    model: choice.model,
    max_completion_tokens: choice.maxTokens ?? 4096,
    messages: [
      { role: "system", content: args.system },
      { role: "user", content: userContent },
    ],
    tools: [{ type: "function", function: args.tool }],
    tool_choice: { type: "function", function: { name: args.tool.name } },
  });

  // Outer loop: retry the whole call when the gateway returns 200 but an empty
  // choices/tool-call payload (Gemini sometimes no-ops on large prompts).
  const EMPTY_RETRIES = 2; // total attempts = EMPTY_RETRIES + 1
  let lastEmptyErr: AiHttpError | null = null;
  for (let emptyAttempt = 0; emptyAttempt <= EMPTY_RETRIES; emptyAttempt++) {
    // Retry on transient upstream issues (503/504) and connection resets.
    const MAX_ATTEMPTS = 3;
    let res: Response | null = null;
    let lastErr: unknown = null;
    for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
      try {
        res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
          method: "POST",
          headers: { Authorization: `Bearer ${LOVABLE_KEY}`, "Content-Type": "application/json" },
          body,
        });
        if (res.ok) break;
        if (res.status === 429) throw new AiHttpError(429, "Rate limit exceeded. Try again later.");
        if (res.status === 402) throw new AiHttpError(402, "AI credits exhausted. Add credits in Lovable settings.");
        if ((res.status === 503 || res.status === 504 || res.status === 502) && attempt < MAX_ATTEMPTS) {
          const wait = attempt * 2500;
          console.warn(`[aiClient] lovable ${res.status}, retrying in ${wait}ms (attempt ${attempt}/${MAX_ATTEMPTS - 1})`);
          await new Promise((r) => setTimeout(r, wait));
          continue;
        }
        const text = await res.text();
        console.error("[aiClient] lovable error", res.status, text);
        throw new AiHttpError(res.status, `AI request failed: ${text}`);
      } catch (e) {
        if (e instanceof AiHttpError) throw e;
        lastErr = e;
        if (attempt < MAX_ATTEMPTS) {
          const wait = attempt * 2500;
          console.warn(`[aiClient] lovable fetch error, retrying in ${wait}ms:`, e);
          await new Promise((r) => setTimeout(r, wait));
          continue;
        }
        throw e;
      }
    }
    if (!res || !res.ok) {
      throw lastErr ?? new AiHttpError(503, "AI request failed after retries");
    }

    const json = await res.json();
    const choice0 = json.choices?.[0];
    const finish = choice0?.finish_reason;
    const usage = json.usage;
    const toolCall = choice0?.message?.tool_calls?.[0];
    const argLen = toolCall?.function?.arguments?.length ?? 0;
    console.log(`[aiClient] lovable model=${choice.model} finish=${finish} prompt_tokens=${usage?.prompt_tokens} completion_tokens=${usage?.completion_tokens} max_tokens=${choice.maxTokens} tool_arg_chars=${argLen} emptyAttempt=${emptyAttempt}`);

    if (!toolCall) {
      lastEmptyErr = new AiHttpError(
        502,
        `AI gateway returned empty response (model=${choice.model}, completion_tokens=${usage?.completion_tokens ?? 0}). The model may be overloaded or the prompt too large.`,
      );
      if (emptyAttempt < EMPTY_RETRIES) {
        const wait = 2000 * (emptyAttempt + 1);
        console.warn(`[aiClient] lovable returned empty, retrying in ${wait}ms (attempt ${emptyAttempt + 1}/${EMPTY_RETRIES})`);
        await new Promise((r) => setTimeout(r, wait));
        continue;
      }
      throw lastEmptyErr;
    }

    if (finish === "length" || finish === "max_tokens") {
      throw new AiHttpError(
        502,
        `AI response truncated by token limit (model=${choice.model}, max_tokens=${choice.maxTokens ?? 4096}). Raise max_tokens for this function in AI Models settings, or switch to a roomier model.`,
      );
    }
    try {
      return JSON.parse(toolCall.function.arguments);
    } catch (e) {
      console.error(`[aiClient] failed to parse tool args (likely truncated). finish=${finish} chars=${argLen}`);
      throw e;
    }
  }
  throw lastEmptyErr ?? new AiHttpError(502, "AI gateway returned empty response");
}

export function aiErrorResponse(err: unknown, corsHeaders: Record<string, string>): Response {
  if (err instanceof AiHttpError) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: err.status,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
  const msg = err instanceof Error ? err.message : String(err);
  return new Response(JSON.stringify({ error: msg }), {
    status: 500,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
