import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { callAiTool, aiErrorResponse, AiHttpError } from "../_shared/aiClient.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;

const SYSTEM_PROMPT = `You are an expert in U.S. federal government contracting and utility-supplier procurement.

Your job: build a complete "service preset" (a reusable AI Lens template) for a single service category.

A preset captures the codes, agencies, vehicles, compliance frameworks, discriminators, and rules an AI assistant would need to evaluate any solicitation in that category. Be specific. Use real NAICS codes, real PSC codes, real agency names, and real contract vehicle names. Never invent vehicle names.

You MUST also return a "reasoning" object with one short sentence per major section explaining WHY you picked those values (e.g. why these NAICS, why these agencies). Reasoning should cite the regulatory or market basis where relevant (FAR clause, statute, agency program).

Match the format and granularity of the example presets provided. Do not narrate. Return ONLY structured output via the tool call.`;

const SCHEMA = {
  name: "build_service_preset",
  description: "A complete service-preset template with reasoning notes",
  parameters: {
    type: "object",
    properties: {
      label: { type: "string", description: "Short human-readable preset name, e.g. 'Federal Cybersecurity Services'" },
      description: { type: "string", description: "One-line description of who this preset is for" },
      family: { type: "string", enum: ["federal", "utility"] },
      content: {
        type: "object",
        properties: {
          naics_codes: { type: "array", items: { type: "string" } },
          psc_codes: { type: "array", items: { type: "string" } },
          set_asides: { type: "array", items: { type: "string" } },
          agencies_focus: { type: "array", items: { type: "string" } },
          contract_vehicles: { type: "array", items: { type: "string" } },
          compliance_frameworks: { type: "array", items: { type: "string" } },
          discriminators: {
            type: "array",
            items: {
              type: "object",
              properties: {
                title: { type: "string" },
                evidence: { type: "string" },
                proof_point: { type: "string" },
              },
              required: ["title", "evidence", "proof_point"],
            },
          },
          acronym_glossary: {
            type: "object",
            description: "Map of acronym -> definition",
            additionalProperties: { type: "string" },
          },
          always_flag: {
            type: "array",
            items: {
              type: "object",
              properties: {
                rule: { type: "string" },
                reason: { type: "string" },
              },
              required: ["rule", "reason"],
            },
          },
          tone_voice: { type: "string", enum: ["formal", "consultative", "technical", "plain"] },
          reading_level: { type: "number", description: "Grade level 8-16" },
          keywords: { type: "array", items: { type: "string" }, description: "Search keywords for matching solicitations" },
        },
        required: [
          "naics_codes", "agencies_focus", "contract_vehicles",
          "compliance_frameworks", "discriminators", "always_flag",
          "tone_voice", "reading_level",
        ],
      },
      reasoning: {
        type: "object",
        properties: {
          naics_codes: { type: "string" },
          psc_codes: { type: "string" },
          agencies_focus: { type: "string" },
          contract_vehicles: { type: "string" },
          compliance_frameworks: { type: "string" },
          discriminators: { type: "string" },
          always_flag: { type: "string" },
        },
      },
    },
    required: ["label", "description", "family", "content", "reasoning"],
  },
};

interface PresetRow {
  id: string;
  key: string;
  label: string;
  description: string | null;
  family: string;
  current_version_id: string | null;
}

function scoreMatch(query: string, label: string, description: string): number {
  const q = query.toLowerCase().split(/\s+/).filter((w) => w.length > 3);
  const text = `${label} ${description}`.toLowerCase();
  let score = 0;
  for (const w of q) if (text.includes(w)) score += 1;
  return score;
}

async function loadFewShot(supabaseAdmin: ReturnType<typeof createClient>, family: string, query: string) {
  const { data: presets } = await supabaseAdmin
    .from("lens_presets")
    .select("id, key, label, description, family, current_version_id")
    .eq("is_builtin", true)
    .eq("family", family)
    .is("deleted_at", null);

  const ranked = ((presets ?? []) as PresetRow[])
    .map((p) => ({ p, score: scoreMatch(query, p.label, p.description ?? "") }))
    .sort((a, b) => b.score - a.score)
    .slice(0, 3);

  const versionIds = ranked.map((r) => r.p.current_version_id).filter(Boolean) as string[];
  if (!versionIds.length) return [] as Array<{ label: string; description: string | null; content: unknown }>;

  const { data: versions } = await supabaseAdmin
    .from("lens_preset_versions")
    .select("id, preset_id, content")
    .in("id", versionIds);

  const byId = new Map((versions ?? []).map((v) => [(v as { id: string }).id, v as { content: unknown; preset_id: string }]));
  return ranked
    .map((r) => {
      const v = r.p.current_version_id ? byId.get(r.p.current_version_id) : null;
      if (!v) return null;
      return { label: r.p.label, description: r.p.description, content: v.content };
    })
    .filter(Boolean) as Array<{ label: string; description: string | null; content: unknown }>;
}

interface RequestBody {
  category?: unknown;
  family?: unknown;
  buyers?: unknown;
  context?: unknown;
}

function validate(body: RequestBody) {
  const errors: string[] = [];
  const category = typeof body.category === "string" ? body.category.trim() : "";
  const family = body.family === "utility" ? "utility" : body.family === "federal" ? "federal" : "";
  const buyers = typeof body.buyers === "string" ? body.buyers.trim() : "";
  const context = typeof body.context === "string" ? body.context.trim() : "";

  if (!category || category.length < 3 || category.length > 200) errors.push("category must be 3-200 chars");
  if (!family) errors.push("family must be 'federal' or 'utility'");
  if (buyers.length > 500) errors.push("buyers too long");
  if (context.length > 2000) errors.push("context too long");
  return { errors, category, family, buyers, context };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    // Authenticate the caller and verify they are an org admin/owner.
    const authHeader = req.headers.get("Authorization") ?? "";
    const userClient = createClient(SUPABASE_URL, ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: userData, error: userErr } = await userClient.auth.getUser();
    if (userErr || !userData?.user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const admin = createClient(SUPABASE_URL, SERVICE_KEY);
    const { data: roleRows } = await admin
      .from("user_roles")
      .select("role")
      .eq("user_id", userData.user.id);
    const roles = (roleRows ?? []).map((r) => (r as { role: string }).role);
    if (!roles.includes("owner") && !roles.includes("admin")) {
      return new Response(JSON.stringify({ error: "Admin role required" }), {
        status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = (await req.json()) as RequestBody;
    const { errors, category, family, buyers, context } = validate(body);
    if (errors.length) {
      return new Response(JSON.stringify({ error: errors.join("; ") }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Few-shot grounding from existing built-ins.
    const examples = await loadFewShot(admin, family, `${category} ${buyers} ${context}`);
    const exampleBlock = examples.length
      ? `\n\nEXAMPLES (match this format and granularity):\n${examples.map((e, i) =>
          `--- Example ${i + 1}: ${e.label} ---\n${JSON.stringify(e.content, null, 2)}`
        ).join("\n\n")}`
      : "";

    const userPrompt = `Build a service preset.

Service category: ${category}
Family: ${family}
Primary buyers: ${buyers || "(unspecified — infer typical buyers for this category)"}
Additional context / differentiators: ${context || "(none provided)"}${exampleBlock}

Return the structured preset via the tool call. Reasoning must explain WHY each section's values were chosen.`;

    const parsed = await callAiTool({
      functionName: "generate-preset",
      system: SYSTEM_PROMPT,
      user: userPrompt,
      tool: SCHEMA,
    });

    return new Response(JSON.stringify({ success: true, draft: parsed }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("[generate-preset] error", e);
    if (e instanceof AiHttpError) return aiErrorResponse(e, corsHeaders);
    return aiErrorResponse(e, corsHeaders);
  }
});
