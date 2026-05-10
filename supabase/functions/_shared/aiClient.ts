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
  "analyze-solicitation": { provider: "anthropic", model: "claude-sonnet-4-5", maxTokens: 8192 },
  "identify-risks-opportunities": { provider: "anthropic", model: "claude-sonnet-4-5", maxTokens: 8192 },
  "generate-questions": { provider: "anthropic", model: "claude-sonnet-4-5", maxTokens: 8192 },
  "generate-report": { provider: "anthropic", model: "claude-sonnet-4-5", maxTokens: 16384 },
  "compare-solicitations": { provider: "anthropic", model: "claude-sonnet-4-5", maxTokens: 8192 },
  "extract-entities": { provider: "anthropic", model: "claude-haiku-4-5", maxTokens: 4096 },
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

export async function callAiTool(args: CallAiArgs): Promise<Record<string, unknown>> {
  const choice = MODEL_CONFIG[args.functionName];
  if (!choice) throw new Error(`No MODEL_CONFIG entry for ${args.functionName}`);

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

  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "x-api-key": ANTHROPIC_KEY,
      "anthropic-version": "2023-06-01",
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const text = await res.text();
    console.error("[aiClient] anthropic error", res.status, text);
    if (res.status === 401) throw new AiHttpError(401, "Anthropic API key invalid");
    if (res.status === 429) throw new AiHttpError(429, "Anthropic rate limit exceeded. Try again later.");
    if (res.status === 402 || res.status === 403) throw new AiHttpError(402, "Anthropic credits/permission issue. Check your account.");
    throw new AiHttpError(res.status, `Anthropic request failed: ${text}`);
  }

  const json = await res.json();
  const toolUse = (json.content ?? []).find((c: { type: string }) => c.type === "tool_use");
  if (!toolUse?.input) throw new Error("AI did not return structured tool_use output");
  return toolUse.input as Record<string, unknown>;
}

async function callLovable(choice: ModelChoice, args: CallAiArgs): Promise<Record<string, unknown>> {
  if (!LOVABLE_KEY) throw new AiHttpError(500, "LOVABLE_API_KEY not configured");

  const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${LOVABLE_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: choice.model,
      messages: [
        { role: "system", content: args.system },
        { role: "user", content: args.user },
      ],
      tools: [{ type: "function", function: args.tool }],
      tool_choice: { type: "function", function: { name: args.tool.name } },
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    console.error("[aiClient] lovable error", res.status, text);
    if (res.status === 429) throw new AiHttpError(429, "Rate limit exceeded. Try again later.");
    if (res.status === 402) throw new AiHttpError(402, "AI credits exhausted. Add credits in Lovable settings.");
    throw new AiHttpError(res.status, `AI request failed: ${text}`);
  }

  const json = await res.json();
  const toolCall = json.choices?.[0]?.message?.tool_calls?.[0];
  if (!toolCall) throw new Error("AI did not return structured tool call");
  return JSON.parse(toolCall.function.arguments);
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
