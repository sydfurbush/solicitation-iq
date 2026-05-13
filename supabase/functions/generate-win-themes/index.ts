import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { callAiTool, aiErrorResponse } from "../_shared/aiClient.ts";
import { buildClientLens } from "../_shared/clientLens.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const SYSTEM_PROMPT = `You generate winning proposal themes for a federal RFP.

Inputs:
- Section M evaluation factors (what scores points)
- Requirements Traceability Matrix
- Client capabilities and past performance
- Incumbent intel

Produce 5-8 candidate WIN THEMES. A win theme = a customer-focused message that ties YOUR strength to the EVALUATOR's hot button. For each theme:
- title: 3-7 words, customer-focused (not "We are great")
- theme_statement: 2-3 sentences expressing the message in customer language
- discriminators: 3-6 specific things that set your client apart from competitors (verifiable claims)
- ghosting_points: 2-4 subtle points that highlight competitor (especially incumbent) weakness without naming them
- proof_points: 3-5 specific, citable past performance / metrics / certifications backing the claim
- evaluation_factor_alignment: which Section M factor(s) this theme targets

Themes must be specific, defensible, and tied to evaluation criteria. Return ONLY structured output.`;

const SCHEMA = {
  name: "generate_win_themes",
  description: "Candidate win themes with discriminators and proof points",
  parameters: {
    type: "object",
    properties: {
      themes: {
        type: "array",
        items: {
          type: "object",
          properties: {
            title: { type: "string" },
            theme_statement: { type: "string" },
            discriminators: { type: "array", items: { type: "string" } },
            ghosting_points: { type: "array", items: { type: "string" } },
            proof_points: { type: "array", items: { type: "string" } },
            evaluation_factor_alignment: { type: "string" },
          },
          required: ["title", "theme_statement"],
        },
      },
    },
    required: ["themes"],
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
      .select("title, ai_summary, evaluation_factors, has_incumbent, incumbent_name, incumbent_performance_notes, client_id, lens_overrides")
      .eq("id", solicitationId)
      .maybeSingle();

    const { data: client } = sol?.client_id
      ? await supabase.from("clients").select("name, industry, notes, metadata").eq("id", sol.client_id).maybeSingle()
      : { data: null };

    const { data: requirements } = await supabase
      .from("requirement_items")
      .select("req_number, shall_text, source_section")
      .eq("solicitation_id", solicitationId)
      .limit(150);

    const { data: sections } = await supabase
      .from("section_analyses")
      .select("section_code, section_title, summary, scoring_weight")
      .eq("solicitation_id", solicitationId);

    const evalFactors = sol?.evaluation_factors as Array<Record<string, unknown>> | null;
    const evalText = evalFactors && evalFactors.length
      ? evalFactors.map((f) => `- ${(f.name as string) ?? "?"}${f.weight ? ` (${f.weight})` : ""}: ${(f.description as string) ?? ""}`).join("\n")
      : (sections ?? []).filter((s) => s.section_code?.startsWith("M")).map((s) =>
          `- ${s.section_code}${s.section_title ? ` ${s.section_title}` : ""}${s.scoring_weight ? ` (weight=${s.scoring_weight})` : ""}: ${s.summary}`
        ).join("\n") || "(none extracted)";

    const capabilities = (client?.metadata as Record<string, unknown> | null)?.capabilities;
    const capText = capabilities
      ? typeof capabilities === "string" ? capabilities : JSON.stringify(capabilities, null, 2)
      : "(no capabilities profile on file)";

    const incumbentText = sol?.has_incumbent
      ? `INCUMBENT: ${sol.incumbent_name ?? "(unnamed)"}${sol.incumbent_performance_notes ? `\nNotes: ${sol.incumbent_performance_notes}` : ""}`
      : "INCUMBENT: none / new requirement";

    const reqText = (requirements ?? []).slice(0, 80).map((r) =>
      `${r.req_number}: ${r.shall_text.slice(0, 200)}`
    ).join("\n");

    const userPrompt = `Solicitation: ${sol?.title ?? "Untitled"}\n\nCLIENT: ${client?.name ?? "?"}\nIndustry: ${client?.industry ?? "?"}\nCapabilities:\n${capText}\n\n${incumbentText}\n\nEVALUATION FACTORS:\n${evalText}\n\nKEY REQUIREMENTS (sample):\n${reqText}\n\nGenerate win themes.`;

    const lens = await buildClientLens(sol?.client_id ?? null, { topic: "win_themes", query: `${(sol as any)?.title ?? ""} ${(sol as any)?.issuing_agency ?? ""} ${(((sol as any)?.ai_summary ?? "") + "").slice(0, 600)}`, override: (sol?.lens_overrides as Record<string, unknown> | null) ?? null });
    const systemPrompt = lens.promptBlock
      ? `${lens.promptBlock}\n\n${SYSTEM_PROMPT}`
      : SYSTEM_PROMPT;

    const parsed = await callAiTool({
      functionName: "generate-win-themes",
      system: systemPrompt,
      user: userPrompt,
      tool: SCHEMA,
    }) as { themes: Array<Record<string, unknown>> };

    const themes = parsed.themes ?? [];

    // Replace existing AI themes that are still draft (preserve approved)
    await supabase
      .from("win_themes")
      .delete()
      .eq("solicitation_id", solicitationId)
      .eq("is_ai_generated", true)
      .eq("status", "draft");

    const rows = themes.map((t) => ({
      solicitation_id: solicitationId,
      title: (t.title as string) ?? "Untitled theme",
      theme_statement: (t.theme_statement as string) ?? null,
      discriminators: (t.discriminators as string[]) ?? [],
      ghosting_points: (t.ghosting_points as string[]) ?? [],
      proof_points: (t.proof_points as string[]) ?? [],
      status: "draft" as const,
      is_ai_generated: true,
      source_citations: t.evaluation_factor_alignment
        ? [{ type: "evaluation_factor", value: t.evaluation_factor_alignment }]
        : [],
    }));

    if (rows.length) {
      const { error } = await supabase.from("win_themes").insert(rows);
      if (error) throw error;
    }

    return new Response(JSON.stringify({ success: true, inserted: rows.length }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("[generate-win-themes] error", e);
    return aiErrorResponse(e, corsHeaders);
  }
});
