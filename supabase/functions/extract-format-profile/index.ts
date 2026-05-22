import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { callAiTool, aiErrorResponse } from "../_shared/aiClient.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const SYSTEM_PROMPT = `You read federal RFP solicitation excerpts (Section L Instructions to Offerors, and any proposal preparation instructions) and extract the document format requirements the bidder must follow.

Extract:
- font (e.g. "Times New Roman", "Arial"). If the RFP allows several, pick the first listed.
- size_pt (numeric font size in points)
- margins_in (numeric margins in inches; pick the smallest required)
- line_spacing (1.0 = single, 1.15, 1.5, 2.0)
- page_number_format (a template like "{volume} - {page} of {pages}" if the RFP specifies pagination form; otherwise omit)
- file_name_pattern (if the RFP specifies a file-naming convention; otherwise omit)
- volume_page_limits: object keyed by volume name with integer page limits, e.g. {"Volume I": 50, "Volume II": 25, "Volume III - Price": null}. Use the EXACT volume names as the RFP names them. Use null if a volume is mentioned with no limit.
- notes: any short, important formatting rules that don't fit the other fields (e.g. "No fold-outs.", "Resumes excluded from page count.")

For EVERY field you extract, also produce a citation that quotes 1-2 sentences from the source and references the L-clause if visible (e.g. "L.5.2(a)").

If you cannot find a field, omit it and add the field name to "unresolved".

Be conservative: only extract what is explicitly stated. Do not infer.

Return ONLY structured output via the tool call.`;

const SCHEMA = {
  name: "extract_format_profile",
  description: "Document format requirements extracted from Section L",
  parameters: {
    type: "object",
    properties: {
      profile: {
        type: "object",
        properties: {
          font: { type: "string" },
          size_pt: { type: "number" },
          margins_in: { type: "number" },
          line_spacing: { type: "number" },
          page_number_format: { type: "string" },
          file_name_pattern: { type: "string" },
          volume_page_limits: {
            type: "object",
            description: "Map of volume name to page limit integer (or null if unlimited)",
            additionalProperties: { type: ["number", "null"] },
          },
          notes: { type: "string" },
        },
      },
      citations: {
        type: "object",
        description: "Map of field name (font, size_pt, margins_in, line_spacing, page_number_format, file_name_pattern, volume_page_limits, notes) to a short quote and L-reference",
        additionalProperties: {
          type: "object",
          properties: {
            quote: { type: "string" },
            l_reference: { type: "string" },
          },
        },
      },
      unresolved: {
        type: "array",
        items: { type: "string" },
        description: "Field names that could not be confidently extracted from the provided excerpts",
      },
      confidence: { type: "number", description: "0..1 overall confidence" },
    },
    required: ["profile"],
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
      .select("title, solicitation_number")
      .eq("id", solicitationId)
      .maybeSingle();

    const { data: documents } = await supabase
      .from("documents")
      .select("id, file_name")
      .eq("solicitation_id", solicitationId)
      .is("deleted_at", null);

    const docIds = (documents ?? []).map((d) => d.id);
    if (docIds.length === 0) {
      return new Response(JSON.stringify({ error: "No documents found for this solicitation" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Pull Section L (and related preparation-instruction) chunks — same path generate-outline uses
    const { data: lSections } = await supabase
      .from("document_sections")
      .select("document_id, section_number, section_title, content, page_start")
      .in("document_id", docIds)
      .or("section_number.ilike.L%,section_title.ilike.%instructions%,section_title.ilike.%preparation%,section_title.ilike.%format%,section_title.ilike.%page limit%")
      .limit(40);

    const docNameById = new Map((documents ?? []).map((d) => [d.id, d.file_name] as const));
    const excerpts = (lSections ?? [])
      .map((s, i) => `[ref:${i + 1}] [${s.section_number ?? "?"} ${s.section_title ?? ""} | doc=${docNameById.get(s.document_id ?? "") ?? "?"} p.${s.page_start ?? "?"}]\n${(s.content ?? "").slice(0, 5000)}`)
      .join("\n\n");

    if (!excerpts) {
      return new Response(JSON.stringify({ error: "No Section L / instructions content found. Process documents first." }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const userPrompt = `Solicitation: ${sol?.title ?? "Untitled"}${sol?.solicitation_number ? ` (${sol.solicitation_number})` : ""}\n\nSECTION L / INSTRUCTIONS EXCERPTS:\n${excerpts}\n\nExtract the format profile.`;

    console.log(`[extract-format-profile] sol=${solicitationId} sections=${lSections?.length ?? 0}`);

    const parsed = await callAiTool({
      functionName: "extract-format-profile",
      system: SYSTEM_PROMPT,
      user: userPrompt,
      tool: SCHEMA,
      modelOverride: { provider: "lovable", model: "google/gemini-2.5-flash", maxTokens: 4000 },
    }) as {
      profile?: Record<string, unknown>;
      citations?: Record<string, { quote?: string; l_reference?: string }>;
      unresolved?: string[];
      confidence?: number;
    };

    return new Response(JSON.stringify({
      profile: parsed.profile ?? {},
      citations: parsed.citations ?? {},
      unresolved: parsed.unresolved ?? [],
      confidence: parsed.confidence ?? null,
      sections_considered: lSections?.length ?? 0,
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("[extract-format-profile] error", e);
    return aiErrorResponse(e, corsHeaders);
  }
});
