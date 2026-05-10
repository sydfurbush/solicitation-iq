import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

import { callAiTool } from "../_shared/aiClient.ts";
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const SYSTEM_PROMPT = `You are an expert proposal strategist analyzing a government solicitation.

Identify two distinct sets:

RISKS — potential threats to winning or executing this contract:
1. Compliance risks (requirements that may be difficult to meet)
2. Technical risks (complex or unclear technical requirements)
3. Staffing risks (specific personnel or certification requirements)
4. Financial risks (unfavorable payment terms, pricing constraints)
5. Schedule risks (aggressive timelines, dependencies)
6. Competitive risks (incumbent advantages, barriers to entry)

For each risk: clear concise title, description with potential impact, severity
(critical=proposal killer, high, medium, low, informational), source citation
(document filename, section, page, verbatim quote ≤280 chars), and a specific
practical mitigation strategy.

OPPORTUNITIES — competitive openings the proposer can exploit:
1. Innovation beyond current solutions
2. Cost reduction language
3. Scope expansion beyond incumbent
4. Process / efficiency improvements
5. Differentiation from competitors
6. Implied or stated incumbent weaknesses
7. Evaluation criteria that favor certain approaches

For each opportunity: actionable title, description with potential impact,
type (innovation, cost_reduction, scope_expansion, efficiency, differentiation,
incumbent_weakness, evaluation_advantage), impact score 1-100, source citation
(document filename, section, page, verbatim quote ≤280 chars), recommended
approach to capitalize, and a brief client capability match suggestion.

Items must be actionable, specific, and grounded in the source. Generate 5-12
risks and 5-12 opportunities. Return ONLY the JSON via the tool call.`;

const SCHEMA = {
  name: "identify_risks_opportunities",
  description: "Risks and opportunities identified from a government solicitation",
  parameters: {
    type: "object",
    properties: {
      risks: {
        type: "array",
        items: {
          type: "object",
          properties: {
            title: { type: "string" },
            description: { type: "string" },
            severity: { type: "string", enum: ["critical", "high", "medium", "low", "informational"] },
            mitigation_strategy: { type: "string" },
            source_document: { type: "string" },
            source_section: { type: "string" },
            source_page: { type: "number" },
            source_quote: { type: "string" },
          },
          required: ["title", "description", "severity"],
        },
      },
      opportunities: {
        type: "array",
        items: {
          type: "object",
          properties: {
            title: { type: "string" },
            description: { type: "string" },
            opportunity_type: {
              type: "string",
              enum: [
                "innovation",
                "cost_reduction",
                "scope_expansion",
                "efficiency",
                "differentiation",
                "incumbent_weakness",
                "evaluation_advantage",
              ],
            },
            impact_score: { type: "number" },
            recommended_approach: { type: "string" },
            client_capability_match: { type: "string" },
            source_document: { type: "string" },
            source_section: { type: "string" },
            source_page: { type: "number" },
            source_quote: { type: "string" },
          },
          required: ["title", "description", "opportunity_type", "impact_score"],
        },
      },
    },
    required: ["risks", "opportunities"],
  },
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const { solicitationId, regenerate } = await req.json();
    if (!solicitationId) {
      return new Response(JSON.stringify({ error: "solicitationId required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    const { data: sol } = await supabase
      .from("solicitations")
      .select("title, ai_summary, key_requirements, evaluation_factors, has_incumbent, incumbent_name")
      .eq("id", solicitationId)
      .maybeSingle();

    const { data: documents } = await supabase
      .from("documents")
      .select("id, file_name")
      .eq("solicitation_id", solicitationId)
      .is("deleted_at", null)
      .in("status", ["parsed", "analyzed"]);

    if (!documents || documents.length === 0) {
      return new Response(JSON.stringify({ error: "No processed documents available." }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const docIds = documents.map((d) => d.id);
    const { data: sections } = await supabase
      .from("document_sections")
      .select("document_id, section_number, section_title, content, page_start, sort_order")
      .in("document_id", docIds)
      .order("sort_order", { ascending: true });

    const docBlocks = documents.map((d) => {
      const ds = (sections ?? []).filter((s) => s.document_id === d.id).slice(0, 30);
      const txt = ds.map((s) => `[${s.section_number ?? "?"} ${s.section_title ?? ""} | p.${s.page_start ?? "?"}]\n${s.content.slice(0, 3000)}`).join("\n\n");
      return `=== DOCUMENT: ${d.file_name} ===\n${txt}`;
    }).join("\n\n");

    const summaryText = sol?.ai_summary ? `\n\nEXISTING ANALYSIS SUMMARY:\n${sol.ai_summary}` : "";
    const incumbentText = sol?.has_incumbent ? `\n\nINCUMBENT: ${sol.incumbent_name ?? "(unknown)"}` : "";

    const userPrompt = `Solicitation: ${sol?.title ?? "Untitled"}${summaryText}${incumbentText}\n\n${docBlocks}`;

    console.log(`[identify-risks-opportunities] sol=${solicitationId} docs=${documents.length} regenerate=${!!regenerate}`);

    const parsed = await callAiTool({
      functionName: "identify-risks-opportunities",
      system: SYSTEM_PROMPT,
      user: userPrompt,
      tool: SCHEMA,
    }) as Record<string, any>;
    const risks = parsed.risks ?? [];
    const opportunities = parsed.opportunities ?? [];

    if (regenerate) {
      await supabase.from("risks").delete().eq("solicitation_id", solicitationId).eq("is_ai_generated", true);
      await supabase.from("opportunities").delete().eq("solicitation_id", solicitationId).eq("is_ai_generated", true);
    }

    const docByName = new Map<string, string>();
    documents.forEach((d) => docByName.set(d.file_name, d.id));

    const buildCitation = (q: Record<string, unknown>) =>
      q.source_section
        ? `Section ${q.source_section}${q.source_page ? `, p.${q.source_page}` : ""}`
        : q.source_page
          ? `p.${q.source_page}`
          : null;

    const riskRows = risks.map((r: Record<string, unknown>) => ({
      solicitation_id: solicitationId,
      title: r.title as string,
      description: r.description as string,
      severity: (r.severity as string) ?? "medium",
      mitigation_strategy: (r.mitigation_strategy as string) ?? null,
      source_document_id: r.source_document ? docByName.get(r.source_document as string) ?? null : null,
      source_citation: buildCitation(r),
      source_quote: (r.source_quote as string) ?? null,
      is_ai_generated: true,
    }));

    const opportunityRows = opportunities.map((o: Record<string, unknown>) => ({
      solicitation_id: solicitationId,
      title: o.title as string,
      description: o.description as string,
      opportunity_type: o.opportunity_type as string,
      impact_score: Math.max(1, Math.min(100, Math.round(Number(o.impact_score) || 50))),
      recommended_approach: (o.recommended_approach as string) ?? null,
      client_capability_match: (o.client_capability_match as string) ?? null,
      source_document_id: o.source_document ? docByName.get(o.source_document as string) ?? null : null,
      source_citation: buildCitation(o),
      source_quote: (o.source_quote as string) ?? null,
      is_ai_generated: true,
    }));

    if (riskRows.length) {
      const { error } = await supabase.from("risks").insert(riskRows);
      if (error) throw error;
    }
    if (opportunityRows.length) {
      const { error } = await supabase.from("opportunities").insert(opportunityRows);
      if (error) throw error;
    }

    return new Response(JSON.stringify({
      success: true,
      risks_count: riskRows.length,
      opportunities_count: opportunityRows.length,
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e) {
    console.error("[identify-risks-opportunities] error", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : String(e) }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
