import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { callAiTool, aiErrorResponse } from "../_shared/aiClient.ts";
import { buildClientLens } from "../_shared/clientLens.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const SYSTEM_PROMPT = `You are a senior proposal writer drafting a single proposal section.

Goals:
- Address every linked "shall" requirement with a specific, defensible response.
- Weave the assigned win themes naturally — show, don't tell.
- Acknowledge known capability gaps with mitigation language (do not hide them).
- Use the client's voice and proof points from the Client Lens.
- Output Markdown. Use H2/H3 headings, short paragraphs, and bulleted lists when listing capabilities or steps.
- Inline-cite each requirement you address as [Req-{req_number}] and each knowledge excerpt as [K{n}] (1-indexed in the order provided).

Avoid: marketing fluff, unverifiable claims, "we are committed to excellence" filler.`;

const SCHEMA = {
  name: "draft_section",
  description: "First-pass section draft in Markdown with citations and per-requirement coverage.",
  parameters: {
    type: "object",
    properties: {
      content_markdown: { type: "string", description: "Full section draft in Markdown." },
      requirement_coverage: {
        type: "array",
        items: {
          type: "object",
          properties: {
            req_number: { type: "string" },
            covered: { type: "boolean" },
            response_summary: { type: "string" },
          },
          required: ["req_number", "covered"],
        },
      },
      themes_woven: { type: "array", items: { type: "string" } },
      open_questions: { type: "array", items: { type: "string" } },
    },
    required: ["content_markdown"],
  },
};

function estimateWords(s: string): number {
  return s.trim().split(/\s+/).filter(Boolean).length;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const { outlineNodeId } = await req.json();
    if (!outlineNodeId) {
      return new Response(JSON.stringify({ error: "outlineNodeId required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const supabase = createClient(SUPABASE_URL, SERVICE_KEY);

    const { data: node } = await supabase.from("outline_nodes").select("*").eq("id", outlineNodeId).maybeSingle();
    if (!node) {
      return new Response(JSON.stringify({ error: "Outline node not found" }), {
        status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const { data: outline } = await supabase.from("proposal_outlines").select("solicitation_id").eq("id", node.outline_id).maybeSingle();
    const solicitationId = outline?.solicitation_id;
    if (!solicitationId) throw new Error("Solicitation not found for node");

    const { data: sol } = await supabase.from("solicitations").select("title, client_id, lens_overrides").eq("id", solicitationId).maybeSingle();

    const reqIds = (node.linked_requirement_ids ?? []) as string[];
    const { data: requirements } = reqIds.length
      ? await supabase.from("requirement_items").select("req_number, shall_text, source_section, category").in("id", reqIds)
      : { data: [] };

    const { data: themes } = await supabase
      .from("win_themes")
      .select("title, theme_statement, discriminators, proof_points")
      .eq("solicitation_id", solicitationId)
      .contains("linked_outline_node_ids", [outlineNodeId]);

    const { data: gaps } = reqIds.length
      ? await supabase.from("capability_gaps").select("title, severity, recommendation").in("requirement_id", reqIds).eq("is_resolved", false)
      : { data: [] };

    const lens = await buildClientLens(sol?.client_id, {
      topic: "draft",
      query: `${node.title} ${(requirements ?? []).map((r) => r.shall_text).join(" ")}`,
    });

    const reqText = (requirements ?? []).map((r) =>
      `- [Req-${r.req_number}] (${r.source_section ?? "?"}, ${r.category ?? "general"}): ${r.shall_text}`
    ).join("\n") || "(no specific requirements linked)";

    const themeText = (themes ?? []).map((t) =>
      `- **${t.title}** — ${t.theme_statement}\n  Discriminators: ${(t.discriminators ?? []).slice(0, 3).join("; ")}\n  Proof: ${(t.proof_points ?? []).slice(0, 3).join("; ")}`
    ).join("\n") || "(no win themes assigned)";

    const gapText = (gaps ?? []).map((g) => `- [${g.severity}] ${g.title} — mitigation: ${g.recommendation ?? "TBD"}`).join("\n") || "(no critical gaps)";

    const knowledgeText = (lens.citations ?? []).slice(0, 6).map((c, i) =>
      `[K${i + 1}] ${c.title ?? "Excerpt"}: ${c.snippet ?? ""}`
    ).join("\n") || "(no knowledge excerpts)";

    const userPrompt = `Solicitation: ${sol?.title ?? "Unknown"}
Section: ${node.section_number ? node.section_number + " " : ""}${node.title}
Volume: ${node.volume ?? "—"}
Section L reference: ${node.source_l_reference ?? "—"}
Page allocation: ${node.page_allocation ?? "—"}
Notes: ${node.notes ?? "—"}

REQUIREMENTS TO ADDRESS
${reqText}

ASSIGNED WIN THEMES
${themeText}

KNOWN GAPS (address with mitigation)
${gapText}

CLIENT KNOWLEDGE EXCERPTS (cite as [K#])
${knowledgeText}

${lens.promptBlock}

Draft the section now.`;

    const result = await callAiTool({
      functionName: "draft-section",
      system: SYSTEM_PROMPT,
      user: userPrompt,
      tool: SCHEMA,
    });

    const markdown = String(result.content_markdown ?? "");
    const wordCount = estimateWords(markdown);
    const pageEstimate = Math.max(1, Math.round(wordCount / 350));

    // Snapshot existing draft (if any) before overwrite.
    const { data: existing } = await supabase
      .from("proposal_drafts")
      .select("id, content_json, content_html, word_count")
      .eq("outline_node_id", outlineNodeId)
      .maybeSingle();

    if (existing && (existing.content_html ?? "").length > 0) {
      await supabase.from("proposal_draft_versions").insert({
        draft_id: existing.id,
        solicitation_id: solicitationId,
        content_json: existing.content_json,
        word_count: existing.word_count ?? 0,
        change_summary: "Pre-AI-draft snapshot",
      });
    }

    const upsert = {
      outline_node_id: outlineNodeId,
      solicitation_id: solicitationId,
      content_json: { markdown, requirement_coverage: result.requirement_coverage ?? [], themes_woven: result.themes_woven ?? [], open_questions: result.open_questions ?? [] },
      content_html: markdown,
      word_count: wordCount,
      page_estimate: pageEstimate,
      last_ai_action: "draft",
    };

    const { data: saved, error: saveErr } = await supabase
      .from("proposal_drafts")
      .upsert(upsert, { onConflict: "outline_node_id" })
      .select()
      .single();
    if (saveErr) throw saveErr;

    try {
      await supabase.from("activity_log").insert({
        solicitation_id: solicitationId,
        event_type: "ai_draft_section",
        event_description: `AI drafted "${node.title}" (~${wordCount} words)`,
        entity_type: "proposal_draft",
        entity_id: saved.id,
        metadata: { outline_node_id: outlineNodeId, word_count: wordCount },
      });
    } catch (_) { /* non-fatal */ }

    return new Response(JSON.stringify({ draft: saved, requirement_coverage: result.requirement_coverage, open_questions: result.open_questions, citations: lens.citations }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("[draft-section]", err);
    return aiErrorResponse(err, corsHeaders);
  }
});
