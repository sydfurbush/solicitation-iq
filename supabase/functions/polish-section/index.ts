import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { callAiTool, aiErrorResponse } from "../_shared/aiClient.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

type Action = "tighten" | "expand" | "rewrite_to_theme" | "compliance_check";

const ACTION_INSTRUCTIONS: Record<Action, string> = {
  tighten: "Tighten this draft. Remove fluff, redundant phrases, and weak hedges. Preserve every requirement citation [Req-X] and knowledge citation [K#]. Aim for ~25% shorter without losing substance.",
  expand: "Expand this draft with more specific evidence: metrics, named past performance, certifications, and process detail. Preserve all existing citations. Add new [K#] / [Req-X] references only if they were already present somewhere in the input citations.",
  rewrite_to_theme: "Rewrite this draft so the assigned win themes lead the section. Open with a theme-anchored topic sentence in each subsection. Preserve all requirement citations [Req-X].",
  compliance_check: "Audit this draft against the linked requirements. Return the rewritten draft with any missing 'shall' responses added inline (mark added text with **[ADDED]** at the start of the new sentence). Then list every requirement and whether it is now addressed.",
};

const SCHEMA = {
  name: "polish_section",
  description: "Polished section draft",
  parameters: {
    type: "object",
    properties: {
      content_markdown: { type: "string" },
      change_summary: { type: "string" },
      requirement_coverage: {
        type: "array",
        items: {
          type: "object",
          properties: {
            req_number: { type: "string" },
            covered: { type: "boolean" },
            note: { type: "string" },
          },
          required: ["req_number", "covered"],
        },
      },
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
    const { draftId, action } = await req.json() as { draftId: string; action: Action };
    if (!draftId || !action || !ACTION_INSTRUCTIONS[action]) {
      return new Response(JSON.stringify({ error: "draftId and valid action required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const supabase = createClient(SUPABASE_URL, SERVICE_KEY);

    const { data: draft } = await supabase.from("proposal_drafts").select("*").eq("id", draftId).maybeSingle();
    if (!draft) {
      return new Response(JSON.stringify({ error: "Draft not found" }), {
        status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: node } = await supabase.from("outline_nodes").select("title, section_number, linked_requirement_ids").eq("id", draft.outline_node_id).maybeSingle();

    const reqIds = (node?.linked_requirement_ids ?? []) as string[];
    const { data: requirements } = reqIds.length
      ? await supabase.from("requirement_items").select("req_number, shall_text").in("id", reqIds)
      : { data: [] };

    const { data: themes } = await supabase
      .from("win_themes")
      .select("title, theme_statement")
      .eq("solicitation_id", draft.solicitation_id)
      .contains("linked_outline_node_ids", [draft.outline_node_id]);

    const reqText = (requirements ?? []).map((r) => `- [Req-${r.req_number}]: ${r.shall_text}`).join("\n") || "(none)";
    const themeText = (themes ?? []).map((t) => `- ${t.title}: ${t.theme_statement}`).join("\n") || "(none)";
    const currentMd = (draft.content_json as { markdown?: string } | null)?.markdown ?? draft.content_html ?? "";

    const userPrompt = `Section: ${node?.section_number ?? ""} ${node?.title ?? ""}

REQUIREMENTS
${reqText}

WIN THEMES
${themeText}

ACTION: ${ACTION_INSTRUCTIONS[action]}

CURRENT DRAFT
${currentMd}`;

    const result = await callAiTool({
      functionName: "polish-section",
      system: "You polish proposal section drafts. Always return the full updated Markdown — never a partial diff.",
      user: userPrompt,
      tool: SCHEMA,
    });

    const markdown = String(result.content_markdown ?? "");
    const wordCount = estimateWords(markdown);
    const pageEstimate = Math.max(1, Math.round(wordCount / 350));

    await supabase.from("proposal_draft_versions").insert({
      draft_id: draftId,
      solicitation_id: draft.solicitation_id,
      content_json: draft.content_json,
      word_count: draft.word_count ?? 0,
      change_summary: `Pre-${action} snapshot`,
    });

    const newJson = { ...(draft.content_json as Record<string, unknown> ?? {}), markdown, last_change_summary: result.change_summary, requirement_coverage: result.requirement_coverage ?? [] };

    const { data: saved, error: saveErr } = await supabase
      .from("proposal_drafts")
      .update({ content_json: newJson, content_html: markdown, word_count: wordCount, page_estimate: pageEstimate, last_ai_action: action })
      .eq("id", draftId)
      .select()
      .single();
    if (saveErr) throw saveErr;

    try {
      await supabase.from("activity_log").insert({
        solicitation_id: draft.solicitation_id,
        event_type: "ai_polish_section",
        event_description: `AI ${action.replace("_", " ")} on "${node?.title ?? "section"}"`,
        entity_type: "proposal_draft",
        entity_id: draftId,
        metadata: { action, word_count: wordCount },
      });
    } catch (_) { /* non-fatal */ }

    return new Response(JSON.stringify({ draft: saved, change_summary: result.change_summary, requirement_coverage: result.requirement_coverage }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("[polish-section]", err);
    return aiErrorResponse(err, corsHeaders);
  }
});
