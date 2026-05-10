import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY")!;
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const SYSTEM_PROMPT = `You are an expert proposal strategist comparing two government solicitations.

Compare these two solicitations and identify all significant changes.

Analyze and report changes in these categories:

1. REQUIREMENTS — added, removed, or modified requirements (each item: type, text, prior_text if modified, significance high/medium/low, citation)
2. EVALUATION FACTORS — added/removed factors and weight changes (each: type, factor, prior_weight, current_weight, notes)
3. SCOPE — expanded, reduced, or modified scope items
4. CONTRACT STRUCTURE — contract type or CLIN structure changes
5. TIMELINE — date or period of performance changes (each: field name, prior, current values as ISO date strings if possible)
6. FINANCIAL — value, ceiling, pricing structure changes (each: field, prior, current, delta description)
7. PERSONNEL — staffing or key personnel changes
8. COMPLIANCE — clauses, certifications, regulations changes
9. INSIGHTS — strategic implications. Categories: agency (priority shift), incumbent (impact), competitor (opening), risk (new threat), opportunity (new opening), strategy (recommendation)
10. RECOMMENDATIONS — short bullet list of how proposal strategy should adapt

Items must be actionable, specific, and grounded in the source. If something didn't change in a category, return an empty array. Return ONLY the JSON via the tool call.`;

const SCHEMA = {
  name: "compare_solicitations",
  description: "Comparison results between two government solicitations",
  parameters: {
    type: "object",
    properties: {
      summary: { type: "string", description: "1-3 sentence overall summary of changes" },
      requirements: {
        type: "array",
        items: {
          type: "object",
          properties: {
            type: { type: "string", enum: ["added", "removed", "modified"] },
            text: { type: "string" },
            prior_text: { type: "string" },
            significance: { type: "string", enum: ["high", "medium", "low"] },
            citation: { type: "string" },
          },
          required: ["type", "text"],
        },
      },
      evaluation_factors: {
        type: "array",
        items: {
          type: "object",
          properties: {
            type: { type: "string", enum: ["added", "removed", "weight_changed", "modified"] },
            factor: { type: "string" },
            prior_weight: { type: "string" },
            current_weight: { type: "string" },
            notes: { type: "string" },
          },
          required: ["type", "factor"],
        },
      },
      scope: { type: "array", items: { type: "object", properties: { type: { type: "string", enum: ["added", "removed", "modified"] }, text: { type: "string" }, prior_text: { type: "string" }, significance: { type: "string" }, citation: { type: "string" } }, required: ["type", "text"] } },
      contract_structure: { type: "array", items: { type: "object", properties: { type: { type: "string" }, text: { type: "string" }, prior_text: { type: "string" }, significance: { type: "string" } }, required: ["type", "text"] } },
      timeline: { type: "array", items: { type: "object", properties: { field: { type: "string" }, prior: { type: "string" }, current: { type: "string" } }, required: ["field"] } },
      financial: { type: "array", items: { type: "object", properties: { field: { type: "string" }, prior: { type: "string" }, current: { type: "string" }, delta: { type: "string" } }, required: ["field"] } },
      personnel: { type: "array", items: { type: "object", properties: { type: { type: "string" }, text: { type: "string" }, prior_text: { type: "string" }, significance: { type: "string" } }, required: ["type", "text"] } },
      compliance: { type: "array", items: { type: "object", properties: { type: { type: "string" }, text: { type: "string" }, prior_text: { type: "string" }, significance: { type: "string" } }, required: ["type", "text"] } },
      insights: { type: "array", items: { type: "object", properties: { title: { type: "string" }, detail: { type: "string" }, category: { type: "string", enum: ["agency", "incumbent", "competitor", "risk", "opportunity", "strategy"] } }, required: ["title", "detail"] } },
      recommendations: { type: "array", items: { type: "string" } },
    },
    required: ["summary"],
  },
};

async function fetchSolicitationContext(supabase: ReturnType<typeof createClient>, solicitationId: string) {
  const { data: sol } = await supabase
    .from("solicitations")
    .select("id, title, solicitation_number, issuing_agency, ai_summary, key_requirements, evaluation_factors, contract_type, estimated_value_low, estimated_value_high, period_of_performance_start, period_of_performance_end, release_date, questions_due_date, proposal_due_date, expected_award_date, has_incumbent, incumbent_name, incumbent_contract_value")
    .eq("id", solicitationId)
    .maybeSingle();
  if (!sol) return null;
  const { data: docs } = await supabase
    .from("documents")
    .select("id, file_name")
    .eq("solicitation_id", solicitationId)
    .is("deleted_at", null)
    .in("status", ["parsed", "analyzed"]);
  const docIds = (docs ?? []).map((d) => d.id);
  let sectionsText = "";
  if (docIds.length) {
    const { data: sections } = await supabase
      .from("document_sections")
      .select("section_number, section_title, content, page_start")
      .in("document_id", docIds)
      .order("sort_order", { ascending: true })
      .limit(60);
    sectionsText = (sections ?? [])
      .map((s) => `[${s.section_number ?? "?"} ${s.section_title ?? ""} | p.${s.page_start ?? "?"}]\n${(s.content ?? "").slice(0, 1800)}`)
      .join("\n\n");
  }
  return { sol, sectionsText };
}

function formatContext(label: string, ctx: { sol: Record<string, unknown>; sectionsText: string } | null, fallbackRef?: string | null) {
  if (!ctx) return `${label}:\n${fallbackRef ? `External reference: ${fallbackRef}` : "(no data available)"}`;
  const s = ctx.sol;
  return `${label}:
Title: ${s.title}
Number: ${s.solicitation_number ?? "—"}
Agency: ${s.issuing_agency ?? "—"}
Contract type: ${s.contract_type ?? "—"}
Value range: ${s.estimated_value_low ?? "—"} – ${s.estimated_value_high ?? "—"}
Period of performance: ${s.period_of_performance_start ?? "—"} → ${s.period_of_performance_end ?? "—"}
Release: ${s.release_date ?? "—"} | Questions due: ${s.questions_due_date ?? "—"} | Proposal due: ${s.proposal_due_date ?? "—"} | Award: ${s.expected_award_date ?? "—"}
Incumbent: ${s.has_incumbent ? (s.incumbent_name ?? "yes") : "no"}${s.incumbent_contract_value ? ` ($${s.incumbent_contract_value})` : ""}

Summary: ${s.ai_summary ?? "(no summary)"}

Key requirements: ${JSON.stringify(s.key_requirements ?? [])}

Evaluation factors: ${JSON.stringify(s.evaluation_factors ?? [])}

DOCUMENT EXCERPTS:
${ctx.sectionsText || "(no parsed sections)"}`;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const { currentSolicitationId, priorSolicitationId, priorRecordId } = await req.json();
    if (!currentSolicitationId) {
      return new Response(JSON.stringify({ error: "currentSolicitationId required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Resolve prior link record
    let linkRecordId = priorRecordId as string | null;
    let externalRef: string | null = null;
    let resolvedPriorId: string | null = priorSolicitationId ?? null;

    const { data: existingLink } = await supabase
      .from("prior_solicitations")
      .select("id, prior_solicitation_id, external_reference")
      .eq("solicitation_id", currentSolicitationId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (existingLink) {
      linkRecordId = linkRecordId ?? existingLink.id;
      resolvedPriorId = resolvedPriorId ?? existingLink.prior_solicitation_id;
      externalRef = existingLink.external_reference;
    }

    if (!linkRecordId) {
      return new Response(JSON.stringify({ error: "No prior solicitation linked" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const currentCtx = await fetchSolicitationContext(supabase, currentSolicitationId);
    const priorCtx = resolvedPriorId ? await fetchSolicitationContext(supabase, resolvedPriorId) : null;

    if (!currentCtx) {
      return new Response(JSON.stringify({ error: "Current solicitation not found" }), {
        status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const userPrompt = `${formatContext("PRIOR SOLICITATION", priorCtx, externalRef)}\n\n${formatContext("CURRENT SOLICITATION", currentCtx)}`;

    console.log(`[compare-solicitations] current=${currentSolicitationId} prior=${resolvedPriorId ?? "external"} link=${linkRecordId}`);

    const parsed = await callAiTool({
      functionName: "compare-solicitations",
      system: SYSTEM_PROMPT,
      user: userPrompt,
      tool: SCHEMA,
    }) as Record<string, any>;

    const summary = parsed.summary as string;
    const changes = {
      requirements: parsed.requirements ?? [],
      evaluation_factors: parsed.evaluation_factors ?? [],
      scope: parsed.scope ?? [],
      contract_structure: parsed.contract_structure ?? [],
      timeline: parsed.timeline ?? [],
      financial: parsed.financial ?? [],
      personnel: parsed.personnel ?? [],
      compliance: parsed.compliance ?? [],
      insights: parsed.insights ?? [],
      recommendations: parsed.recommendations ?? [],
    };

    const { error: updateErr } = await supabase
      .from("prior_solicitations")
      .update({
        comparison_summary: summary,
        changes_identified: changes,
        comparison_completed_at: new Date().toISOString(),
      })
      .eq("id", linkRecordId);
    if (updateErr) throw updateErr;

    return new Response(JSON.stringify({ success: true, summary, changes }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("[compare-solicitations] error", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : String(e) }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
