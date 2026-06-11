import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { aiErrorResponse, callAiTool } from "../_shared/aiClient.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const PERSONA_FRAGMENTS: Record<string, string> = {
  capture_manager: "a senior Capture Manager focused on win strategy and competitive positioning",
  proposal_writer: "a senior Proposal Writer focused on section narrative and persuasive language",
  compliance_reviewer: "a strict Compliance Reviewer focused on Section L/M and shall-statements",
  pricing_analyst: "a Pricing Analyst focused on cost, BOEs, and price-to-win",
  executive: "an executive briefer focused on bottom-line summaries for leadership",
  plain_english: "a plain-English explainer who avoids jargon",
};

const TOOL_SCHEMA = {
  name: "starters",
  description: "Four short starter prompts tailored to this solicitation and persona.",
  parameters: {
    type: "object",
    properties: {
      starters: {
        type: "array",
        minItems: 4,
        maxItems: 4,
        items: { type: "string", description: "A short, specific question the user could ask. Max ~90 chars." },
      },
    },
    required: ["starters"],
  },
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const t0 = Date.now();
  try {
    const authHeader = req.headers.get("Authorization") ?? "";
    const token = authHeader.replace("Bearer ", "");
    const userClient = createClient(SUPABASE_URL, Deno.env.get("SUPABASE_ANON_KEY") ?? "", {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user } } = await userClient.auth.getUser(token);
    if (!user) {
      return new Response(JSON.stringify({ error: "unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { solicitationId, persona, plainMode } = await req.json();
    if (!solicitationId) {
      return new Response(JSON.stringify({ error: "solicitationId is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supa = createClient(SUPABASE_URL, SERVICE_KEY);

    // Pull lightweight context (RLS-bypassing via service role, but we already authenticated the user)
    const [{ data: sol }, { data: risks }, { data: reqs }] = await Promise.all([
      supa.from("solicitations")
        .select("title,issuing_agency,solicitation_number,ai_summary,current_phase,proposal_due_date")
        .eq("id", solicitationId).maybeSingle(),
      supa.from("risks").select("title,severity").eq("solicitation_id", solicitationId).limit(6),
      supa.from("requirement_items").select("title,is_critical").eq("solicitation_id", solicitationId).limit(8),
    ]);

    if (!sol) {
      return new Response(JSON.stringify({ error: "solicitation not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const personaKey = String(persona ?? "capture_manager");
    const personaDesc = PERSONA_FRAGMENTS[personaKey] ?? PERSONA_FRAGMENTS.capture_manager;
    const plainLine = plainMode
      ? "\nWrite the starters in plain English: short sentences, no jargon, no acronyms unless defined."
      : "";

    const system = `You generate four short, highly specific starter prompts a user could ask an AI assistant about ONE government solicitation. They must reference real details from the context provided (agency, risks, requirements, phase). They must be tuned for ${personaDesc}.${plainLine}\nEach starter <= 90 characters, written as a first-person question or directive (e.g. "Summarize…", "What are…"). Avoid generic prompts.`;

    const user_block = `# Solicitation
Title: ${sol.title}
Number: ${sol.solicitation_number ?? "—"}
Agency: ${sol.issuing_agency ?? "—"}
Phase: ${sol.current_phase ?? "—"}
Due: ${sol.proposal_due_date ?? "—"}
Summary: ${(sol.ai_summary ?? "").slice(0, 1200)}

# Top risks
${(risks ?? []).map((r: any, i: number) => `${i + 1}. [${r.severity}] ${r.title}`).join("\n") || "—"}

# Key requirements
${(reqs ?? []).map((r: any, i: number) => `${i + 1}. ${r.is_critical ? "(critical) " : ""}${r.title}`).join("\n") || "—"}

Produce exactly 4 starter prompts.`;

    let result: any;
    try {
      result = await callAiTool({
        functionName: "generate-assistant-starters",
        system,
        user: user_block,
        tool: TOOL_SCHEMA,
      });
    } catch (err) {
      // Audit failure
      await supa.from("assistant_audit_log").insert({
        user_id: user.id,
        solicitation_id: solicitationId,
        model: "starters",
        persona: personaKey,
        status: "error",
        error: err instanceof Error ? err.message : String(err),
        latency_ms: Date.now() - t0,
      });
      return aiErrorResponse(err, corsHeaders);
    }

    const starters = Array.isArray(result?.starters)
      ? result.starters.filter((s: unknown) => typeof s === "string" && s.trim().length > 0).slice(0, 4)
      : [];

    await supa.from("assistant_audit_log").insert({
      user_id: user.id,
      solicitation_id: solicitationId,
      persona: personaKey,
      model: "starters",
      status: "ok",
      latency_ms: Date.now() - t0,
    });

    return new Response(JSON.stringify({ starters }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("[generate-assistant-starters]", err);
    return aiErrorResponse(err, corsHeaders);
  }
});
