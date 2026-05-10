import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY")!;
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const SYSTEM_PROMPT = `You are an expert proposal strategist analyzing a government solicitation. Generate strategic questions that help the proposer:
1. Clarify ambiguous requirements
2. Identify strategic advantages (questions to hold back)
3. Uncover scope expansion opportunities
4. Flag potential risks
5. Ensure compliance understanding

For each question:
- Provide the exact question text as it would be submitted to the agency (professional tone)
- Explain WHY this question matters strategically
- Cite the EXACT source (document filename, section, page, verbatim quote up to 280 chars)
- Recommend whether to ASK, HOLD, MONITOR, or keep INTERNAL
- Assign a priority score 1-100

Focus on questions that reveal where the agency wants innovation beyond incumbent capabilities, ambiguities that could be interpreted favorably, evaluation criteria clarifications, technical approach flexibility, and pricing structure opportunities.

Generate 8-15 questions distributed across all 5 categories. Return ONLY the JSON via the tool call.`;

const SCHEMA = {
  name: "generate_strategic_questions",
  description: "Strategic questions for a government solicitation",
  parameters: {
    type: "object",
    properties: {
      questions: {
        type: "array",
        items: {
          type: "object",
          properties: {
            question_text: { type: "string" },
            category: { type: "string", enum: ["clarification", "strategic", "scope_expansion", "risk_concern", "compliance"] },
            recommendation: { type: "string", enum: ["ask", "hold", "monitor", "internal_only"] },
            priority: { type: "number" },
            question_rationale: { type: "string" },
            strategic_advantage_notes: { type: "string" },
            potential_answer_insight: { type: "string" },
            source_document: { type: "string" },
            source_section: { type: "string" },
            source_page: { type: "number" },
            source_quote: { type: "string" },
          },
          required: ["question_text", "category", "recommendation", "priority", "question_rationale"],
        },
      },
    },
    required: ["questions"],
  },
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const { solicitationId, focusAreas, focusDocumentIds, regenerate } = await req.json();
    if (!solicitationId) {
      return new Response(JSON.stringify({ error: "solicitationId required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    const { data: sol } = await supabase
      .from("solicitations")
      .select("title, ai_summary, key_requirements, evaluation_factors")
      .eq("id", solicitationId)
      .maybeSingle();

    let docQuery = supabase
      .from("documents")
      .select("id, file_name")
      .eq("solicitation_id", solicitationId)
      .is("deleted_at", null)
      .in("status", ["parsed", "analyzed"]);
    if (focusDocumentIds?.length) docQuery = docQuery.in("id", focusDocumentIds);
    const { data: documents } = await docQuery;

    if (!documents || documents.length === 0) {
      return new Response(JSON.stringify({ error: "No processed documents available." }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const docIds = documents.map((d) => d.id);
    const docMap = new Map(documents.map((d) => [d.id, d.file_name] as const));

    const { data: sections } = await supabase
      .from("document_sections")
      .select("id, document_id, section_number, section_title, content, page_start, sort_order")
      .in("document_id", docIds)
      .order("sort_order", { ascending: true });

    const docBlocks = documents.map((d) => {
      const ds = (sections ?? []).filter((s) => s.document_id === d.id).slice(0, 30);
      const txt = ds.map((s) => `[${s.section_number ?? "?"} ${s.section_title ?? ""} | p.${s.page_start ?? "?"}]\n${s.content.slice(0, 3000)}`).join("\n\n");
      return `=== DOCUMENT: ${d.file_name} ===\n${txt}`;
    }).join("\n\n");

    const focusText = focusAreas?.length ? `\n\nFOCUS AREAS: ${focusAreas.join(", ")}` : "";
    const summaryText = sol?.ai_summary ? `\n\nEXISTING ANALYSIS SUMMARY:\n${sol.ai_summary}` : "";

    const userPrompt = `Solicitation: ${sol?.title ?? "Untitled"}${summaryText}${focusText}\n\n${docBlocks}`;

    console.log(`[generate-questions] sol=${solicitationId} docs=${documents.length} regenerate=${!!regenerate}`);

    const aiRes = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "google/gemini-2.5-pro",
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: userPrompt },
        ],
        tools: [{ type: "function", function: SCHEMA }],
        tool_choice: { type: "function", function: { name: "generate_strategic_questions" } },
      }),
    });

    if (!aiRes.ok) {
      const errText = await aiRes.text();
      console.error("[generate-questions] AI error", aiRes.status, errText);
      if (aiRes.status === 429) return new Response(JSON.stringify({ error: "Rate limit exceeded." }), { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      if (aiRes.status === 402) return new Response(JSON.stringify({ error: "AI credits exhausted." }), { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      throw new Error(`AI request failed: ${errText}`);
    }

    const aiJson = await aiRes.json();
    const toolCall = aiJson.choices?.[0]?.message?.tool_calls?.[0];
    if (!toolCall) throw new Error("AI did not return questions");
    const { questions } = JSON.parse(toolCall.function.arguments);

    if (regenerate) {
      await supabase.from("strategic_questions").delete().eq("solicitation_id", solicitationId).eq("is_ai_generated", true);
    }

    const docByName = new Map<string, string>();
    documents.forEach((d) => docByName.set(d.file_name, d.id));

    const rows = (questions ?? []).map((q: Record<string, unknown>) => {
      const sourceDocId = q.source_document ? docByName.get(q.source_document as string) : null;
      return {
        solicitation_id: solicitationId,
        question_text: q.question_text as string,
        question_rationale: (q.question_rationale as string) ?? null,
        category: q.category as string,
        recommendation: (q.recommendation as string) ?? "monitor",
        priority: Math.max(1, Math.min(100, Math.round(Number(q.priority) || 50))),
        source_document_id: sourceDocId ?? null,
        source_citation: q.source_section ? `Section ${q.source_section}${q.source_page ? `, p.${q.source_page}` : ""}` : null,
        source_quote: (q.source_quote as string) ?? null,
        strategic_advantage_notes: (q.strategic_advantage_notes as string) ?? null,
        potential_answer_insight: (q.potential_answer_insight as string) ?? null,
        is_ai_generated: true,
      };
    });

    if (rows.length) {
      const { error: insErr } = await supabase.from("strategic_questions").insert(rows);
      if (insErr) throw insErr;
    }

    return new Response(JSON.stringify({ success: true, count: rows.length }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("[generate-questions] error", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : String(e) }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
