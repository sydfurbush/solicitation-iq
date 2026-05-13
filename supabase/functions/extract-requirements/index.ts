import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { callAiTool, aiErrorResponse } from "../_shared/aiClient.ts";
import { buildClientLens } from "../_shared/clientLens.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const SYSTEM_PROMPT = `You build a Requirements Traceability Matrix (RTM) for a federal proposal.

For every binding obligation in the source documents — verbs like "shall", "must", "will", or "is required to" — emit ONE row. Be exhaustive. Do not summarize, do not deduplicate, do not skip "minor" requirements. A typical RFP has 80-300 shall statements.

For each row return:
- req_number: hierarchical number you assign in source order, e.g. "C-3.2.1.4" preferred when the source numbering exists, else sequential "R-001", "R-002"...
- shall_text: the verbatim binding sentence (≤500 chars, trim only)
- source_section: the source section code, prefer the Section letter+number (e.g. "C.3.2", "L.5", "M.4(a)")
- source_document: filename of the document the statement came from
- source_page: page number if known
- source_quote: short quoted snippet (≤280 chars) including the binding verb

Return ONLY structured output via the tool call.`;

const SCHEMA = {
  name: "extract_requirements",
  description: "List of every binding requirement (shall/must/will) in the solicitation.",
  parameters: {
    type: "object",
    properties: {
      requirements: {
        type: "array",
        items: {
          type: "object",
          properties: {
            req_number: { type: "string" },
            shall_text: { type: "string" },
            source_section: { type: "string" },
            source_document: { type: "string" },
            source_page: { type: "number" },
            source_quote: { type: "string" },
          },
          required: ["req_number", "shall_text"],
        },
      },
    },
    required: ["requirements"],
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

    const supabase = createClient(SUPABASE_URL, SERVICE_KEY);

    const { data: sol } = await supabase
      .from("solicitations")
      .select("title, client_id, lens_overrides")
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

    // Pre-filter to sections that actually contain binding verbs to keep the AI
    // payload small enough to finish within the 150s edge function idle timeout.
    const BINDING_RE = /\b(shall|must|will|is required to|are required to|is responsible for|are responsible for)\b/i;
    const MAX_TOTAL_CHARS = 180_000; // keep prompt well under model context + latency budget
    const PER_SECTION_CHARS = 1400;

    let usedChars = 0;
    const docBlocks = documents.map((d) => {
      const all = (sections ?? []).filter((s) => s.document_id === d.id);
      const relevant = all.filter((s) => BINDING_RE.test(s.content ?? ""));
      const pick = (relevant.length ? relevant : all).slice(0, 60);
      const parts: string[] = [];
      for (const s of pick) {
        if (usedChars >= MAX_TOTAL_CHARS) break;
        const remaining = MAX_TOTAL_CHARS - usedChars;
        const slice = (s.content ?? "").slice(0, Math.min(PER_SECTION_CHARS, remaining));
        const block = `[${s.section_number ?? "?"} ${s.section_title ?? ""} | p.${s.page_start ?? "?"}]\n${slice}`;
        parts.push(block);
        usedChars += block.length;
      }
      return `=== DOCUMENT: ${d.file_name} ===\n${parts.join("\n\n")}`;
    }).join("\n\n");

    console.log(`[extract-requirements] prompt_chars=${usedChars}`);

    const userPrompt = `Solicitation: ${sol?.title ?? "Untitled"}\n\n${docBlocks}\n\nExtract every binding requirement.`;

    console.log(`[extract-requirements] sol=${solicitationId} docs=${documents.length}`);

    const lens = await buildClientLens(sol?.client_id ?? null, { topic: "requirements", override: (sol?.lens_overrides as Record<string, unknown> | null) ?? null });
    const systemPrompt = lens.promptBlock ? `${lens.promptBlock}\n\n${SYSTEM_PROMPT}` : SYSTEM_PROMPT;

    const parsed = await callAiTool({
      functionName: "extract-requirements",
      system: systemPrompt,
      user: userPrompt,
      tool: SCHEMA,
    }) as { requirements: Array<Record<string, unknown>> };

    const items = parsed.requirements ?? [];

    if (regenerate) {
      await supabase
        .from("requirement_items")
        .delete()
        .eq("solicitation_id", solicitationId)
        .eq("is_ai_generated", true);
    }

    const docByName = new Map<string, string>();
    documents.forEach((d) => docByName.set(d.file_name, d.id));

    const rows = items.map((r, i) => ({
      solicitation_id: solicitationId,
      req_number: (r.req_number as string) ?? `R-${String(i + 1).padStart(3, "0")}`,
      shall_text: (r.shall_text as string) ?? "",
      source_section: (r.source_section as string) ?? null,
      source_document_id: r.source_document ? docByName.get(r.source_document as string) ?? null : null,
      page_number: r.source_page ? Number(r.source_page) : null,
      source_quote: (r.source_quote as string) ?? null,
      source_citation: r.source_section
        ? `${r.source_section}${r.source_page ? `, p.${r.source_page}` : ""}`
        : r.source_page
          ? `p.${r.source_page}`
          : null,
      is_ai_generated: true,
    })).filter((r) => r.shall_text);

    if (rows.length) {
      const { error } = await supabase.from("requirement_items").insert(rows);
      if (error) throw error;
    }

    return new Response(JSON.stringify({ success: true, inserted: rows.length }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("[extract-requirements] error", e);
    return aiErrorResponse(e, corsHeaders);
  }
});
