import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY")!;
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const SYSTEM_PROMPT = `You are an expert government contracting analyst with 20+ years of experience reviewing federal RFPs, RFQs, and IDIQ solicitations. Your job is to extract strategic intelligence that helps a contractor decide whether to bid and how to win.

You will receive excerpts from one or more solicitation documents and must produce a single JSON object that strictly matches the provided schema. Always:
- Cite EXACT sections (e.g. "L.5.2") and page numbers when available.
- Quote source text verbatim in the "quote" field (max 280 chars).
- Use priority levels: critical (must comply or no-bid), high, medium, low.
- Return at most 10 key requirements, ranked by importance.
- If a field cannot be determined from the documents, use null or an empty array.
- Confidence score is 0.0-1.0 reflecting how complete the source material is.

Output ONLY the JSON object, no prose.`;

const ANALYSIS_SCHEMA = {
  name: "solicitation_analysis",
  description: "Structured analysis of a government solicitation",
  parameters: {
    type: "object",
    properties: {
      executive_summary: { type: "string" },
      key_requirements: {
        type: "array",
        items: {
          type: "object",
          properties: {
            id: { type: "string" },
            text: { type: "string" },
            priority: { type: "string", enum: ["critical", "high", "medium", "low"] },
            category: { type: "string", enum: ["technical", "management", "staffing", "compliance", "other"] },
            source: {
              type: "object",
              properties: {
                document: { type: "string" },
                section: { type: "string" },
                page: { type: "number" },
                quote: { type: "string" },
              },
            },
          },
          required: ["id", "text", "priority", "category"],
        },
      },
      evaluation_factors: {
        type: "array",
        items: {
          type: "object",
          properties: {
            name: { type: "string" },
            weight: { type: "number" },
            description: { type: "string" },
            subfactors: { type: "array", items: { type: "string" } },
            source: {
              type: "object",
              properties: {
                document: { type: "string" },
                section: { type: "string" },
                page: { type: "number" },
                quote: { type: "string" },
              },
            },
          },
          required: ["name"],
        },
      },
      incumbent_info: {
        type: "object",
        properties: {
          detected: { type: "boolean" },
          name: { type: "string" },
          contract_number: { type: "string" },
          indicators: { type: "array", items: { type: "string" } },
        },
      },
      contract_structure: {
        type: "object",
        properties: {
          type: { type: "string" },
          base_period: { type: "string" },
          option_periods: { type: "string" },
          ceiling_value: { type: "string" },
          clins_detected: { type: "boolean" },
          pricing_structure: { type: "string" },
        },
      },
      risk_signals: { type: "array", items: { type: "string" } },
      opportunity_signals: { type: "array", items: { type: "string" } },
      confidence_score: { type: "number" },
    },
    required: ["executive_summary", "key_requirements", "evaluation_factors", "confidence_score"],
  },
};

function buildUserPrompt(documents: Array<{ name: string; sections: Array<{ section_number: string | null; section_title: string | null; content: string; page_start: number | null }>; entities: Array<{ entity_type: string; entity_value: string }> }>) {
  const docBlocks = documents.map((d) => {
    const sectionText = d.sections
      .map(
        (s) =>
          `[Section ${s.section_number ?? "?"} - ${s.section_title ?? "Untitled"} | p.${s.page_start ?? "?"}]\n${s.content.slice(0, 4000)}`
      )
      .join("\n\n");
    const entityText = d.entities.length
      ? `\nKey extracted entities:\n${d.entities.slice(0, 60).map((e) => `- ${e.entity_type}: ${e.entity_value}`).join("\n")}`
      : "";
    return `=== DOCUMENT: ${d.name} ===\n${sectionText}${entityText}`;
  });
  return `Analyze the following solicitation documents and produce the JSON analysis.\n\n${docBlocks.join("\n\n")}`;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const { solicitationId, analysisType = "full" } = await req.json();
    if (!solicitationId) {
      return new Response(JSON.stringify({ error: "solicitationId required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Fetch documents (parsed/analyzed only)
    const { data: documents, error: docErr } = await supabase
      .from("documents")
      .select("id, file_name, status")
      .eq("solicitation_id", solicitationId)
      .is("deleted_at", null)
      .in("status", ["parsed", "analyzed"]);

    if (docErr) throw docErr;
    if (!documents || documents.length === 0) {
      return new Response(JSON.stringify({ error: "No processed documents available. Upload and process documents first." }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const docIds = documents.map((d) => d.id);

    // Sections
    const { data: sections } = await supabase
      .from("document_sections")
      .select("document_id, section_number, section_title, content, page_start, sort_order")
      .in("document_id", docIds)
      .order("sort_order", { ascending: true });

    // Entities
    const { data: entities } = await supabase
      .from("extracted_entities")
      .select("document_id, entity_type, entity_value")
      .in("document_id", docIds);

    const docPayload = documents.map((d) => ({
      name: d.file_name,
      sections: (sections ?? []).filter((s) => s.document_id === d.id).slice(0, 40),
      entities: (entities ?? []).filter((e) => e.document_id === d.id),
    }));

    const userPrompt = buildUserPrompt(docPayload);

    console.log(`[analyze-solicitation] sol=${solicitationId} type=${analysisType} docs=${documents.length} promptChars=${userPrompt.length}`);

    const analysis = await callAiTool({
      functionName: "analyze-solicitation",
      system: SYSTEM_PROMPT,
      user: userPrompt,
      tool: ANALYSIS_SCHEMA,
    }) as Record<string, any>;

    // Persist
    const incumbent = analysis.incumbent_info ?? {};
    const updatePayload: Record<string, unknown> = {
      ai_summary: analysis.executive_summary,
      ai_confidence_score: analysis.confidence_score ?? null,
      key_requirements: analysis.key_requirements ?? [],
      evaluation_factors: analysis.evaluation_factors ?? [],
      status: "phase_1_complete",
      metadata: {
        analysis: {
          last_analyzed_at: new Date().toISOString(),
          analysis_type: analysisType,
          document_ids: docIds,
          contract_structure: analysis.contract_structure ?? null,
          incumbent_info: incumbent,
          risk_signals: analysis.risk_signals ?? [],
          opportunity_signals: analysis.opportunity_signals ?? [],
        },
      },
    };

    if (incumbent.detected) {
      updatePayload.has_incumbent = true;
      if (incumbent.name) updatePayload.incumbent_name = incumbent.name;
      if (incumbent.contract_number) updatePayload.incumbent_contract_number = incumbent.contract_number;
    }

    const { error: updErr } = await supabase
      .from("solicitations")
      .update(updatePayload)
      .eq("id", solicitationId);
    if (updErr) throw updErr;

    return new Response(JSON.stringify({ success: true, analysis }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("[analyze-solicitation] error", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : String(e) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
