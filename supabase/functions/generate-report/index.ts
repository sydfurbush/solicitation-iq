import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

import { callAiTool } from "../_shared/aiClient.ts";
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

type ReportType =
  | "executive_summary"
  | "full_analysis"
  | "questions_brief"
  | "risk_assessment"
  | "opportunity_brief"
  | "comparison_report"
  | "proposal_outline";

const PROMPTS: Record<ReportType, string> = {
  executive_summary: `Generate a professional executive summary report. Sections: Executive Overview (1 paragraph), Opportunity Snapshot (bullets: agency, solicitation #, contract type, value range, key dates, incumbent), Strategic Assessment (top 3 opportunities, top 3 risks, competitive positioning), Recommendation (go/no-go, rationale, key success factors, next steps). Crisp executive language. Use markdown. Cite as [Doc §Section p.X].`,
  full_analysis: `Generate a comprehensive solicitation analysis report. Sections: Executive Summary, Solicitation Overview, Requirements Analysis, Evaluation Criteria Analysis, Risk Assessment, Opportunities Analysis, Competitive Landscape, Strategic Questions, Comparison to Prior Solicitation (skip if no data), Proposal Strategy Recommendations, Appendices. Every claim cites [Doc §Section p.X]. Use markdown.`,
  questions_brief: `Generate a Strategic Questions brief. Sections: Submitted Questions (recommendation 'ask', numbered Q&A with rationale), Strategic Hold Questions (recommendation 'hold', explain advantage), Internal Discussion Items (monitor/internal). Citations required.`,
  risk_assessment: `Generate a Risk Assessment. Sections: Risk Overview (summary + count by severity), Critical Risks (each high/critical risk with description, citation, mitigation), Mitigation Plan (prioritized actions).`,
  opportunity_brief: `Generate an Opportunity Brief. Sections: Opportunity Overview, High-Impact Opportunities (each with description, recommended approach, capability match, citation), Recommended Capture Approach.`,
  comparison_report: `Generate a Comparison Report from the supplied prior-solicitation data. Sections: Comparison Summary, Key Changes (requirements, evaluation factors, scope, timeline, financial), Strategic Implications. Markdown.`,
  proposal_outline: `Generate a Proposal Outline. Sections: Volume Structure (recommended volumes with page-limit suggestions), Section Outline (mapped to evaluation factors), Compliance Matrix (markdown table: Requirement | Source | Volume/Section | Notes), Win Themes (3-5 with proof points), Discriminators (3-5), Key Personnel Requirements, Past Performance Suggestions.`,
};

const SCHEMA = {
  name: "generate_report",
  description: "Structured executive report content",
  parameters: {
    type: "object",
    properties: {
      title: { type: "string" },
      subtitle: { type: "string" },
      sections: {
        type: "array",
        items: {
          type: "object",
          properties: {
            id: { type: "string" },
            heading: { type: "string" },
            level: { type: "number", enum: [1, 2, 3] },
            body: { type: "string", description: "Markdown body for this section." },
          },
          required: ["heading", "body"],
        },
      },
      citations: {
        type: "array",
        items: {
          type: "object",
          properties: {
            id: { type: "string" },
            document: { type: "string" },
            section: { type: "string" },
            page: { type: "number" },
            quote: { type: "string" },
          },
          required: ["id", "document"],
        },
      },
    },
    required: ["title", "sections"],
  },
};

async function gatherContext(supabase: ReturnType<typeof createClient>, solicitationId: string) {
  const { data: sol } = await supabase
    .from("solicitations")
    .select("*, client:clients(name, organization_id)")
    .eq("id", solicitationId)
    .maybeSingle();

  const { data: documents } = await supabase
    .from("documents")
    .select("id, file_name, document_type, ai_summary")
    .eq("solicitation_id", solicitationId)
    .is("deleted_at", null);

  const { data: questions } = await supabase
    .from("strategic_questions")
    .select("category, recommendation, priority, question_text, question_rationale, source_citation, source_quote")
    .eq("solicitation_id", solicitationId)
    .order("priority", { ascending: false })
    .limit(40);

  const { data: risks } = await supabase
    .from("risks")
    .select("title, description, severity, mitigation_strategy, source_citation, source_quote")
    .eq("solicitation_id", solicitationId)
    .order("severity", { ascending: true })
    .limit(40);

  const { data: opportunities } = await supabase
    .from("opportunities")
    .select("title, description, opportunity_type, impact_score, recommended_approach, client_capability_match, source_citation, source_quote")
    .eq("solicitation_id", solicitationId)
    .order("impact_score", { ascending: false })
    .limit(40);

  const { data: priorLink } = await supabase
    .from("prior_solicitations")
    .select("comparison_summary, changes_identified, external_reference")
    .eq("solicitation_id", solicitationId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  return { sol, documents, questions, risks, opportunities, priorLink };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const { solicitationId, reportType, options } = await req.json();
    if (!solicitationId || !reportType) {
      return new Response(JSON.stringify({ error: "solicitationId and reportType required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const prompt = PROMPTS[reportType as ReportType];
    if (!prompt) {
      return new Response(JSON.stringify({ error: `Unknown reportType: ${reportType}` }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    const ctx = await gatherContext(supabase, solicitationId);
    if (!ctx.sol) {
      return new Response(JSON.stringify({ error: "Solicitation not found" }), {
        status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const auth = req.headers.get("Authorization");
    let userId: string | null = null;
    if (auth) {
      const userClient = createClient(SUPABASE_URL, Deno.env.get("SUPABASE_ANON_KEY")!, {
        global: { headers: { Authorization: auth } },
      });
      const { data } = await userClient.auth.getUser();
      userId = data.user?.id ?? null;
    }

    const sol = ctx.sol;
    const userPrompt = `SOLICITATION DATA
Title: ${sol.title}
Number: ${sol.solicitation_number ?? "—"}
Agency: ${sol.issuing_agency ?? "—"}
Client: ${(sol.client as { name?: string } | null)?.name ?? "—"}
Contract type: ${sol.contract_type ?? "—"}
Value: ${sol.estimated_value_low ?? "—"} – ${sol.estimated_value_high ?? "—"}
Period: ${sol.period_of_performance_start ?? "—"} → ${sol.period_of_performance_end ?? "—"}
Release: ${sol.release_date ?? "—"} | Q&A due: ${sol.questions_due_date ?? "—"} | Proposal due: ${sol.proposal_due_date ?? "—"} | Award: ${sol.expected_award_date ?? "—"}
Incumbent: ${sol.has_incumbent ? sol.incumbent_name ?? "yes" : "no"}

AI SUMMARY: ${sol.ai_summary ?? "(none)"}

KEY REQUIREMENTS: ${JSON.stringify(sol.key_requirements ?? [])}

EVALUATION FACTORS: ${JSON.stringify(sol.evaluation_factors ?? [])}

DOCUMENTS (${ctx.documents?.length ?? 0}):
${(ctx.documents ?? []).map((d) => `- ${d.file_name} [${d.document_type}]${d.ai_summary ? ` — ${d.ai_summary.slice(0, 200)}` : ""}`).join("\n")}

STRATEGIC QUESTIONS:
${JSON.stringify(ctx.questions ?? [])}

RISKS:
${JSON.stringify(ctx.risks ?? [])}

OPPORTUNITIES:
${JSON.stringify(ctx.opportunities ?? [])}

PRIOR SOLICITATION COMPARISON:
${ctx.priorLink ? JSON.stringify(ctx.priorLink) : "(none linked)"}

REPORT OPTIONS:
${JSON.stringify(options ?? {})}`;

    console.log(`[generate-report] sol=${solicitationId} type=${reportType}`);

    const parsed = await callAiTool({
      functionName: "generate-report",
      system: `You are an expert proposal strategist generating professional client deliverables. ${prompt}`,
      user: userPrompt,
      tool: SCHEMA,
    }) as Record<string, any>;

    const content = {
      title: parsed.title ?? `${reportType.replace(/_/g, " ")} – ${sol.title}`,
      subtitle: parsed.subtitle ?? sol.solicitation_number ?? null,
      generatedAt: new Date().toISOString(),
      meta: {
        solicitation_number: sol.solicitation_number,
        agency: sol.issuing_agency,
        client: (sol.client as { name?: string } | null)?.name,
        contract_type: sol.contract_type,
      },
      sections: parsed.sections ?? [],
      citations: parsed.citations ?? [],
      options: options ?? {},
    };

    const { data: report, error } = await supabase
      .from("executive_reports")
      .insert({
        solicitation_id: solicitationId,
        title: content.title,
        report_type: reportType,
        content,
        generated_by: userId,
      })
      .select()
      .single();
    if (error) throw error;

    return new Response(JSON.stringify({ success: true, report }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("[generate-report] error", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : String(e) }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
