import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

import { callAiTool } from "../_shared/aiClient.ts";
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
- Choose a category. If a strategically important question does not fit any of the first 5 categories (clarification, strategic, scope_expansion, risk_concern, compliance), use "other" rather than discarding it or force-fitting it.

Focus on questions that reveal where the agency wants innovation beyond incumbent capabilities, ambiguities that could be interpreted favorably, evaluation criteria clarifications, technical approach flexibility, pricing structure opportunities, and any other material item a bidder would want clarified before proposing.

Generate 10-25 questions covering whichever categories the solicitation actually warrants — do NOT force a specific distribution. Be exhaustive: it is better to surface a borderline question under "other" than to omit it. Return ONLY the JSON via the tool call.`;

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
            category: { type: "string", enum: ["clarification", "strategic", "scope_expansion", "risk_concern", "compliance", "other"] },
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

    const MAX_SECTIONS_PER_DOC = 12;
    const MAX_CHARS_PER_SECTION = 1200;
    const MAX_TOTAL_CHARS = 120_000;
    let totalChars = 0;
    const docBlocks = documents.map((d) => {
      const ds = (sections ?? []).filter((s) => s.document_id === d.id).slice(0, MAX_SECTIONS_PER_DOC);
      const parts: string[] = [];
      for (const s of ds) {
        if (totalChars >= MAX_TOTAL_CHARS) break;
        const remaining = MAX_TOTAL_CHARS - totalChars;
        const body = (s.content ?? "").slice(0, Math.min(MAX_CHARS_PER_SECTION, remaining));
        const chunk = `[${s.section_number ?? "?"} ${s.section_title ?? ""} | p.${s.page_start ?? "?"}]\n${body}`;
        parts.push(chunk);
        totalChars += chunk.length;
      }
      return `=== DOCUMENT: ${d.file_name} ===\n${parts.join("\n\n")}`;
    }).join("\n\n");

    const focusText = focusAreas?.length ? `\n\nFOCUS AREAS: ${focusAreas.join(", ")}` : "";
    const summaryText = sol?.ai_summary ? `\n\nEXISTING ANALYSIS SUMMARY:\n${sol.ai_summary}` : "";

    const userPrompt = `Solicitation: ${sol?.title ?? "Untitled"}${summaryText}${focusText}\n\n${docBlocks}`;

    console.log(`[generate-questions] sol=${solicitationId} docs=${documents.length} promptChars=${userPrompt.length} regenerate=${!!regenerate}`);

    const parsedQ = await callAiTool({
      functionName: "generate-questions",
      system: SYSTEM_PROMPT,
      user: userPrompt,
      tool: SCHEMA,
    }) as Record<string, any>;
    const { questions } = parsedQ;

    const docByName = new Map<string, string>();
    documents.forEach((d) => docByName.set(d.file_name, d.id));

    const VALID_CATEGORIES = new Set(["clarification", "strategic", "scope_expansion", "risk_concern", "compliance", "other"]);

    const rows = (questions ?? []).map((q: Record<string, unknown>) => {
      const sourceDocId = q.source_document ? docByName.get(q.source_document as string) : null;
      let category = (q.category as string) ?? "other";
      if (!VALID_CATEGORIES.has(category)) {
        console.warn(`[generate-questions] unknown category "${category}" coerced to "other"`);
        category = "other";
      }
      return {
        solicitation_id: solicitationId,
        question_text: q.question_text as string,
        question_rationale: (q.question_rationale as string) ?? null,
        category,
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

    if (rows.length === 0) {
      console.warn(`[generate-questions] AI returned 0 questions for sol=${solicitationId}; preserving existing questions`);
      return new Response(JSON.stringify({
        error: "AI returned no questions. Try again, or narrow focus areas/documents to reduce input size.",
      }), {
        status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (rows.length < 8) {
      console.warn(`[generate-questions] only ${rows.length} questions generated for sol=${solicitationId}`);
    }

    if (regenerate) {
      await supabase.from("strategic_questions").delete().eq("solicitation_id", solicitationId).eq("is_ai_generated", true);
    }

    const { error: insErr } = await supabase.from("strategic_questions").insert(rows);
    if (insErr) throw insErr;

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
