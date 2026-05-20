import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { callAiTool, aiErrorResponse } from "../_shared/aiClient.ts";
import { buildClientLens, getClientIdForSolicitation } from "../_shared/clientLens.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const SYSTEM_PROMPT = `You are a senior capture/proposal strategist drafting a SPECIFIC mitigation
plan for ONE risk on a government solicitation.

Use the Client Lens (profile, capability templates, past performance excerpts) to
ground the mitigation in the client's actual strengths. Do NOT invent capabilities,
certifications, contracts, or personnel that are not in the provided context.

Write a single, tight mitigation paragraph (120-220 words) structured with three
labeled lines, in this exact order:

Approach: <what the client will concretely do to mitigate this risk>
Owner: <role / function inside the client team that owns this mitigation>
Evidence: <past performance, certs, tooling, or knowledge excerpts that prove
the approach is credible — cite [K#] tags from Client Knowledge when used>

Rules:
- Plain text only. No markdown headers, no bullets, no preamble.
- Be specific to THIS risk and THIS client. Avoid generic platitudes like
  "we will manage carefully" or "industry best practices".
- If the Client Lens has no relevant proof, say so honestly in Evidence
  ("No directly applicable past performance on file — recommend sourcing one
  before submission.").
- Never recommend marking the risk mitigated. Only describe the plan.`;

const SCHEMA = {
  name: "suggest_risk_mitigation",
  description: "Draft a client-aware mitigation plan for a single risk.",
  parameters: {
    type: "object",
    properties: {
      mitigation_strategy: {
        type: "string",
        description: "Plain-text paragraph with Approach / Owner / Evidence lines.",
      },
      used_sources: {
        type: "array",
        description: "Client knowledge excerpts cited (by [K#] tag) in the strategy.",
        items: {
          type: "object",
          properties: {
            tag: { type: "string" },
            document_title: { type: "string" },
            snippet: { type: "string" },
          },
          required: ["tag", "document_title"],
        },
      },
    },
    required: ["mitigation_strategy"],
  },
};

function admin() {
  return createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    // JWT validation
    const authHeader = req.headers.get("Authorization") ?? "";
    if (!authHeader.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const userClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: userData, error: authErr } = await userClient.auth.getUser();
    if (authErr || !userData?.user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json().catch(() => ({}));
    const riskId = typeof body?.riskId === "string" ? body.riskId : null;
    if (!riskId || !/^[0-9a-f-]{36}$/i.test(riskId)) {
      return new Response(JSON.stringify({ error: "riskId (uuid) is required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const sb = admin();
    const { data: risk, error: riskErr } = await sb
      .from("risks")
      .select("id, solicitation_id, title, description, severity, source_citation, source_quote, mitigation_strategy")
      .eq("id", riskId)
      .maybeSingle();
    if (riskErr || !risk) {
      return new Response(JSON.stringify({ error: "Risk not found" }), {
        status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: sol } = await sb
      .from("solicitations")
      .select("title, issuing_agency, agency_type, contract_type, set_aside, has_incumbent, incumbent_name, incumbent_performance_notes, period_of_performance_start, period_of_performance_end")
      .eq("id", risk.solicitation_id)
      .maybeSingle();

    const clientId = await getClientIdForSolicitation(risk.solicitation_id);
    const query = `${risk.title}\n${risk.description}\n${risk.source_quote ?? ""}`.slice(0, 4000);
    const lens = await buildClientLens(clientId, { topic: "risks", query, topK: 6 });

    const userPrompt = [
      lens.promptBlock,
      "",
      "## Solicitation context",
      sol ? [
        sol.title && `Title: ${sol.title}`,
        sol.issuing_agency && `Agency: ${sol.issuing_agency}`,
        sol.contract_type && `Contract type: ${sol.contract_type}`,
        sol.set_aside && `Set-aside: ${sol.set_aside}`,
        sol.has_incumbent && `Incumbent: ${sol.incumbent_name ?? "yes"}${sol.incumbent_performance_notes ? ` — ${sol.incumbent_performance_notes}` : ""}`,
        (sol.period_of_performance_start || sol.period_of_performance_end) &&
          `PoP: ${sol.period_of_performance_start ?? "?"} → ${sol.period_of_performance_end ?? "?"}`,
      ].filter(Boolean).join("\n") : "(none)",
      "",
      "## The risk to mitigate",
      `Title: ${risk.title}`,
      `Severity: ${risk.severity}`,
      `Description: ${risk.description}`,
      risk.source_citation ? `Source: ${risk.source_citation}` : "",
      risk.source_quote ? `Source quote: "${risk.source_quote}"` : "",
      risk.mitigation_strategy
        ? `\n## Existing mitigation notes (improve / replace)\n${risk.mitigation_strategy}`
        : "",
      "",
      "Draft the mitigation now. Return ONLY via the tool call.",
    ].filter(Boolean).join("\n");

    const result = await callAiTool({
      functionName: "suggest-risk-mitigation",
      system: SYSTEM_PROMPT,
      user: userPrompt,
      tool: SCHEMA,
    });

    const mitigation_strategy = String((result as { mitigation_strategy?: string }).mitigation_strategy ?? "").trim();
    const used_sources = Array.isArray((result as { used_sources?: unknown }).used_sources)
      ? (result as { used_sources: Array<{ tag?: string; document_title?: string; snippet?: string }> }).used_sources
      : [];

    if (!mitigation_strategy) {
      return new Response(JSON.stringify({ error: "AI returned empty mitigation" }), {
        status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(
      JSON.stringify({
        ok: true,
        mitigation_strategy,
        used_sources,
        knowledge_count: lens.citations.length,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err) {
    console.error("[suggest-risk-mitigation] error", err);
    return aiErrorResponse(err, corsHeaders);
  }
});
