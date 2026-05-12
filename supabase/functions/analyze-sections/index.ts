import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { callAiTool, aiErrorResponse } from "../_shared/aiClient.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const SYSTEM_PROMPT = `You analyze a federal solicitation section by section.

Identify each major UCF/RFP section present in the source (e.g. A, B, C, L, M, plus PWS/SOW if present). For each section:
- summary: 3-6 sentence plain-language explanation of what the section requires/governs
- requirements_count: rough count of binding requirements (shall/must/will) found in this section
- scoring_weight: numeric weight or % ONLY if the source explicitly states one (e.g. "Technical = 40 points" in Section M). Otherwise null.
- importance_score: integer 1-5 (REQUIRED for every section). Reflects strategic weight to the proposal:
    5 = Section M evaluation factors / award criteria
    4 = PWS/SOW core scope, Section L instructions to offerors, key deliverables
    3 = pricing schedules, CDRLs, technical exhibits with substantive content
    2 = administrative clauses, representations, schedules
    1 = boilerplate cover forms (SF 1449, SF 30), reference appendices
- importance_rationale: ≤140 char explanation of the importance_score
- risk_flags: short bullet phrases (≤120 chars each) identifying risky/unusual/aggressive language
- source_citations: verbatim short quotes (≤200 chars) backing each risk flag

Be exhaustive. Cover every section that appears. Return ONLY structured output via the tool call.`;

const SCHEMA = {
  name: "analyze_sections",
  description: "Per-section analysis of a federal solicitation",
  parameters: {
    type: "object",
    properties: {
      sections: {
        type: "array",
        items: {
          type: "object",
          properties: {
            section_code: { type: "string", description: "Section letter or code, e.g. 'L', 'M', 'C.3'" },
            section_title: { type: "string" },
            summary: { type: "string" },
            requirements_count: { type: "number" },
            scoring_weight: { type: "number" },
            importance_score: { type: "integer", minimum: 1, maximum: 5 },
            importance_rationale: { type: "string" },
            risk_flags: { type: "array", items: { type: "string" } },
            source_citations: { type: "array", items: { type: "string" } },
          },
          required: ["section_code", "summary", "importance_score"],
        },
      },
    },
    required: ["sections"],
  },
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const { solicitationId } = await req.json();
    if (!solicitationId) {
      return new Response(JSON.stringify({ error: "solicitationId required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const supabase = createClient(SUPABASE_URL, SERVICE_KEY);

    const { data: sol } = await supabase
      .from("solicitations")
      .select("title, ai_summary")
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
      const txt = ds
        .map((s) => `[${s.section_number ?? "?"} ${s.section_title ?? ""} | p.${s.page_start ?? "?"}]\n${s.content.slice(0, 1500)}`)
        .join("\n\n");
      return `=== DOCUMENT: ${d.file_name} ===\n${txt}`;
    }).join("\n\n");

    const userPrompt = `Solicitation: ${sol?.title ?? "Untitled"}${sol?.ai_summary ? `\n\nSUMMARY:\n${sol.ai_summary}` : ""}\n\n${docBlocks}\n\nProduce per-section analysis.`;

    console.log(`[analyze-sections] sol=${solicitationId} docs=${documents.length} prompt_chars=${userPrompt.length}`);

    // Run AI + DB write in background to avoid 150s edge timeout. Client polls section_analyses.
    const work = (async () => {
      try {
        const parsed = await callAiTool({
          functionName: "analyze-sections",
          system: SYSTEM_PROMPT,
          user: userPrompt,
          tool: SCHEMA,
        }) as { sections: Array<Record<string, unknown>> };

        const out = parsed.sections ?? [];

        await supabase
          .from("section_analyses")
          .delete()
          .eq("solicitation_id", solicitationId)
          .eq("is_ai_generated", true);

        const rows = out.map((s) => ({
          solicitation_id: solicitationId,
          section_code: (s.section_code as string) ?? "?",
          section_title: (s.section_title as string) ?? null,
          summary: (s.summary as string) ?? "",
          requirements_count: s.requirements_count ? Number(s.requirements_count) : 0,
          scoring_weight: s.scoring_weight ? Number(s.scoring_weight) : null,
          risk_flags: (s.risk_flags as string[]) ?? [],
          source_citations: (s.source_citations as string[]) ?? [],
          is_ai_generated: true,
        })).filter((r) => r.summary);

        if (rows.length) {
          const { error } = await supabase.from("section_analyses").insert(rows);
          if (error) throw error;
        }
        console.log(`[analyze-sections] background done sol=${solicitationId} inserted=${rows.length}`);
      } catch (err) {
        console.error("[analyze-sections] background error", err);
      }
    })();

    // @ts-ignore EdgeRuntime is provided by Supabase runtime
    if (typeof EdgeRuntime !== "undefined" && EdgeRuntime.waitUntil) {
      // @ts-ignore
      EdgeRuntime.waitUntil(work);
    }

    return new Response(JSON.stringify({ success: true, status: "processing" }), {
      status: 202,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("[analyze-sections] error", e);
    return aiErrorResponse(e, corsHeaders);
  }
});
