import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

import { callAiTool } from "../_shared/aiClient.ts";
import { buildClientLens } from "../_shared/clientLens.ts";
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

type ReportType =
  | "executive_summary"
  | "full_analysis"
  | "questions_brief"
  | "client_questionnaire"
  | "risk_assessment"
  | "opportunity_brief"
  | "comparison_report"
  | "proposal_outline";

const BLOCKS_GUIDE = `

OUTPUT STRUCTURE — IMPORTANT:
Each section MAY return either a markdown 'body' (prose) OR an array of structured 'blocks' (preferred for branded layout).
Block kinds available:
- { "kind":"paragraph", "text":"..." }
- { "kind":"bullets", "items":["...","..."] }
- { "kind":"kv", "rows":[["Label","Value"], ...] }                       // key/value snapshot table
- { "kind":"category", "tone":"opportunity"|"risk"|"neutral", "title":"TOP OPPORTUNITIES", "rows":[["Title","Description"], ...] }
- { "kind":"recommendation", "verdict":"GO"|"NO-GO"|"CONDITIONAL GO", "rationale":"..." }
- { "kind":"steps", "items":[{"title":"Submit Questions","detail":"..."}, ...] }

Use blocks for: Opportunity Snapshot (kv), Strategic Assessment (category opportunity + category risk), Recommendation (recommendation), Next Steps (steps).
Use paragraphs/bullets for narrative sections.
`;

const PROMPTS: Record<ReportType, string> = {
  executive_summary: `Generate a professional Executive Summary. Return EXACTLY these 7 sections, in this order, each as a SEPARATE entry in 'sections[]' with the EXACT heading text shown and ONLY the block kinds specified. DO NOT bundle multiple sections into one. DO NOT use markdown body — every section must use 'blocks'.

1. heading="Executive Overview" — 1 to 2 'paragraph' blocks. Narrative overview, our overall assessment.
2. heading="Opportunity Snapshot" — exactly ONE 'kv' block. Rows in this order: ["Agency", ...], ["Solicitation #", ...], ["Contract Type", ...], ["Set-Aside", ...], ["Incumbent", ...], ["Release Date", ...], ["Q&A / Proposal Due", ...], ["Award Date", ...]. Use "—" if unknown.
3. heading="Strategic Assessment" — exactly TWO 'category' blocks. First: tone="opportunity", title="TOP OPPORTUNITIES", 3 rows of [shortTitle, oneSentenceDescription]. Second: tone="risk", title="TOP RISKS", 3 rows.
4. heading="Competitive Positioning" — one 'paragraph' block + one 'bullets' block (3-5 items).
5. heading="Recommendation" — exactly ONE 'recommendation' block. verdict is one of "GO" | "NO-GO" | "CONDITIONAL GO". rationale is 2-3 sentences. NO other blocks in this section. NEVER include Key Success Factors or Next Steps text inside this block.
6. heading="Key Success Factors" — exactly ONE 'bullets' block, 3-5 items. Each item is a single sentence (no numbering prefixes — the renderer handles formatting).
7. heading="Next Steps" — exactly ONE 'steps' block, 3-5 items. Each item is { title: short action (2-4 words), detail: one-sentence explanation }.

OPTIONAL 8th section — heading="Utility Bid Snapshot": INCLUDE this section ONLY when the Client Lens contains a "Utility-supplier context" block. Emit exactly ONE 'kv' block with these rows in this order (use "—" if unknown, omit a row only if entirely N/A): ["Regulatory Regime", "..."], ["ISO/RTO", "..."], ["Voltage / Pressure / GPM Class", "..."], ["Delivery Model Match", "..."], ["Prequal Platform & Grade", "..."], ["Bonding vs. Required", "..."], ["Safety (TRIR/EMR) vs. Buyer Threshold", "..."], ["PE Jurisdiction Coverage", "..."], ["Diversity / Tier Match", "..."], ["Buy America / PWA Exposure", "..."], ["Outage / SLA Exposure", "..."], ["Mutual-Aid / Storm Posture", "..."]. If no Utility-supplier context is present, OMIT this section entirely.

Cite inline as [Doc §Section p.X] where relevant. Crisp executive language.${BLOCKS_GUIDE}`,
  full_analysis: `Generate a comprehensive solicitation analysis report. Sections: Executive Summary, Solicitation Overview, Requirements Analysis, Evaluation Criteria Analysis, Risk Assessment, Opportunities Analysis, Competitive Landscape, Strategic Questions, Comparison to Prior Solicitation (skip if no data), Proposal Strategy Recommendations, Appendices. Every claim cites [Doc §Section p.X]. Use markdown.`,
  questions_brief: `Generate a Strategic Questions brief. Sections: Submitted Questions (recommendation 'ask', numbered Q&A with rationale), Strategic Hold Questions (recommendation 'hold', explain advantage), Internal Discussion Items (monitor/internal). Citations required.`,
  client_questionnaire: `Client-ready strategic questionnaire (deterministic — handled in code).`,
  risk_assessment: `Generate a Risk Assessment. Sections: Risk Overview (summary + count by severity), Critical Risks (each high/critical risk with description, citation, mitigation), Mitigation Plan (prioritized actions).`,
  opportunity_brief: `Generate an Opportunity Brief. Sections: Opportunity Overview, High-Impact Opportunities (each with description, recommended approach, capability match, citation), Recommended Capture Approach.`,
  comparison_report: `Generate a Comparison Report from the supplied prior-solicitation data. Sections: Comparison Summary, Key Changes (requirements, evaluation factors, scope, timeline, financial), Strategic Implications. Markdown.`,
  proposal_outline: `Generate a Proposal Outline. Sections: Volume Structure (recommended volumes with page-limit suggestions), Section Outline (mapped to evaluation factors), Compliance Matrix (markdown table: Requirement | Source | Volume/Section | Notes), Win Themes (3-5 with proof points), Discriminators (3-5), Key Personnel Requirements, Past Performance Suggestions.`,
};

const BLOCK_SCHEMA = {
  type: "object",
  description: "Structured content block. Choose 'kind' to determine which other fields are populated.",
  properties: {
    kind: { type: "string", description: "One of: paragraph, bullets, kv, category, recommendation, steps." },
    text: { type: "string", description: "Used when kind=paragraph." },
    items: {
      type: "array",
      description: "Used when kind=bullets (array of {text}) or kind=steps (array of {title, detail}).",
      items: {
        type: "object",
        description: "For bullets, only 'text' is used. For steps, 'title' and 'detail' are used.",
        properties: {
          text: { type: "string", description: "Bullet text (used when parent block kind=bullets)." },
          title: { type: "string", description: "Step title (used when parent block kind=steps)." },
          detail: { type: "string", description: "Step detail (used when parent block kind=steps)." },
        },
      },
    },
    rows: {
      type: "array",
      description: "Used when kind=kv or kind=category. Array of two-element [label, value] string arrays.",
      items: {
        type: "array",
        description: "Two-element [label, value] pair.",
        items: { type: "string", description: "Cell text." },
      },
    },
    tone: { type: "string", description: "Used when kind=category. One of: opportunity, risk, neutral." },
    title: { type: "string", description: "Used when kind=category. Header bar title (e.g., TOP OPPORTUNITIES)." },
    verdict: { type: "string", description: "Used when kind=recommendation. e.g., GO, NO-GO, CONDITIONAL GO." },
    rationale: { type: "string", description: "Used when kind=recommendation. Italic supporting text." },
  },
};

const SCHEMA = {
  name: "generate_report",
  description: "Structured executive report content",
  parameters: {
    type: "object",
    properties: {
      title: { type: "string", description: "Report title." },
      subtitle: { type: "string", description: "Report subtitle (e.g., solicitation number)." },
      sections: {
        type: "array",
        description: "Ordered report sections.",
        items: {
          type: "object",
          description: "A report section. Use 'blocks' for branded layout, or 'body' for plain markdown.",
          properties: {
            id: { type: "string", description: "Stable section identifier." },
            heading: { type: "string", description: "Section heading text." },
            level: { type: "integer", description: "Heading level 1-3." },
            body: { type: "string", description: "Optional markdown body — used only when 'blocks' is not provided." },
            blocks: {
              type: "array",
              description: "Preferred: structured content blocks for branded rendering.",
              items: BLOCK_SCHEMA,
            },
          },
        },
      },
      citations: {
        type: "array",
        description: "Inline source citations referenced in section bodies.",
        items: {
          type: "object",
          description: "A single source citation.",
          properties: {
            id: { type: "string", description: "Citation identifier (e.g., C1)." },
            document: { type: "string", description: "Source document name." },
            section: { type: "string", description: "Source section." },
            page: { type: "integer", description: "Source page number." },
            quote: { type: "string", description: "Optional quoted text." },
          },
        },
      },
    },
    required: ["title", "sections"],
  },
};

async function gatherContext(supabase: ReturnType<typeof createClient>, solicitationId: string, reportType: ReportType) {
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

  const isQBrief = reportType === "questions_brief" || reportType === "client_questionnaire";
  let qQuery = supabase
    .from("strategic_questions")
    .select("category, recommendation, priority, question_text, question_rationale, source_citation, source_quote, source_document_id, is_submitted, agency_response")
    .eq("solicitation_id", solicitationId)
    .order("priority", { ascending: false });
  if (!isQBrief) qQuery = qQuery.limit(40);
  const { data: questions } = await qQuery;

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
    const basePrompt = PROMPTS[reportType as ReportType];
    const includeCitations = options?.includeCitations !== false;
    const includeRecommendations = options?.includeRecommendations !== false;
    const citationsRule = includeCitations
      ? `\n\nCITATIONS (REQUIRED): Populate the top-level 'citations' array with every source you reference. Use stable IDs C1, C2, C3… Each entry: { id, document, section?, page?, quote? }. In section prose/blocks, cite as [C1], [C2] — NOT [Doc §X p.Y]. Pull sources from DOCUMENTS, RISKS.source_citation, OPPORTUNITIES.source_citation, and STRATEGIC QUESTIONS.source_citation in the user message. Aim for 4-8 citations minimum when documents exist.`
      : `\n\nCITATIONS: Do NOT include any inline citation markers. Return citations: [].`;
    const recRule = includeRecommendations
      ? ""
      : `\n\nRECOMMENDATIONS: OMIT the "Recommendation" and "Next Steps" sections entirely. Do not emit them in sections[].`;
    const prompt = basePrompt + citationsRule + recRule;
    if (!basePrompt) {
      return new Response(JSON.stringify({ error: `Unknown reportType: ${reportType}` }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    const ctx = await gatherContext(supabase, solicitationId, reportType as ReportType);
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

    // Deterministic path: questions_brief renders ALL questions from DB,
    // bypassing the model so nothing is dropped/summarized.
    if (reportType === "questions_brief" || reportType === "client_questionnaire") {
      const isClientQ = reportType === "client_questionnaire";
      const all = (ctx.questions ?? []) as Array<{
        category: string | null;
        recommendation: string | null;
        priority: number | null;
        question_text: string;
        question_rationale: string | null;
        source_citation: string | null;
        source_quote: string | null;
        is_submitted: boolean | null;
        agency_response: string | null;
      }>;

      const groupOf = (rec: string | null) => {
        const r = (rec ?? "").toLowerCase();
        if (r === "ask") return "ask";
        if (r === "hold") return "hold";
        return "internal";
      };
      const groups: Record<"ask" | "hold" | "internal", typeof all> = { ask: [], hold: [], internal: [] };
      for (const q of all) groups[groupOf(q.recommendation)].push(q);
      for (const k of Object.keys(groups) as Array<keyof typeof groups>) {
        groups[k].sort((a, b) =>
          (b.priority ?? 0) - (a.priority ?? 0) ||
          String(a.category ?? "").localeCompare(String(b.category ?? ""))
        );
      }

      // Category normalization (mirrors theme.ts normalizeCategoryTone)
      type Tone = "contradiction" | "risk_concern" | "quantitative_gap" | "compliance" | "drafting_error" | "clarification" | "scope_expansion" | "strategic" | "internal" | "neutral";
      const TONE_LABEL: Record<Tone, string> = {
        contradiction: "CONTRADICTION", risk_concern: "RISK CONCERN", quantitative_gap: "QUANTITATIVE GAP",
        compliance: "COMPLIANCE", drafting_error: "DRAFTING ERROR", clarification: "CLARIFICATION",
        scope_expansion: "SCOPE EXPANSION", strategic: "STRATEGIC", internal: "INTERNAL", neutral: "QUESTION",
      };
      const TONE_TITLE: Record<Tone, string> = {
        contradiction: "Contradictions", risk_concern: "Risk Concerns", quantitative_gap: "Quantitative Gaps",
        compliance: "Compliance Questions", drafting_error: "Drafting Errors", clarification: "Clarifications",
        scope_expansion: "Scope Expansion", strategic: "Strategic", internal: "Internal", neutral: "Questions",
      };
      const TONE_ORDER: Tone[] = ["contradiction", "risk_concern", "quantitative_gap", "compliance", "drafting_error", "clarification", "scope_expansion", "strategic", "internal", "neutral"];
      const toneOf = (cat: string | null | undefined): Tone => {
        const k = (cat ?? "").toLowerCase();
        if (k.includes("contradict")) return "contradiction";
        if (k.includes("risk")) return "risk_concern";
        if (k.includes("quant") || k.includes("gap")) return "quantitative_gap";
        if (k.includes("compli")) return "compliance";
        if (k.includes("draft") || k.includes("error")) return "drafting_error";
        if (k.includes("clarif")) return "clarification";
        if (k.includes("scope")) return "scope_expansion";
        if (k.includes("strateg") || k.includes("hold")) return "strategic";
        if (k.includes("internal") || k.includes("monitor")) return "internal";
        return "neutral";
      };

      const sectionDef: Array<{ key: keyof typeof groups; heading: string; intro: (n: number) => string; subgroup: boolean }> = [
        { key: "ask",      heading: "Submitted Questions",         intro: (n) => `${n} question${n === 1 ? "" : "s"} recommended for submission to the agency, organized by category.`, subgroup: true },
        { key: "hold",     heading: "Strategic Hold Questions",    intro: (n) => `${n} question${n === 1 ? "" : "s"} held for strategic advantage — do not submit.`, subgroup: false },
        { key: "internal", heading: "Internal Discussion Items",   intro: (n) => `${n} item${n === 1 ? "" : "s"} for internal review and capture planning.`, subgroup: false },
      ];

      // Build category counts for stats strip
      const catCounts: Record<Tone, number> = {
        contradiction: 0, risk_concern: 0, quantitative_gap: 0, compliance: 0, drafting_error: 0,
        clarification: 0, scope_expansion: 0, strategic: 0, internal: 0, neutral: 0,
      };
      for (const q of all) catCounts[toneOf(q.category)]++;
      const groupCount = (k: "ask" | "hold" | "internal") => groups[k].length;

      const statsTiles: Array<{ label: string; value: number | string }> = [
        { label: "Total Questions", value: all.length },
        { label: "Contradictions", value: catCounts.contradiction },
        { label: "Risk Concerns", value: catCounts.risk_concern },
        { label: "Quantitative Gaps", value: catCounts.quantitative_gap },
        { label: "Drafting Errors", value: catCounts.drafting_error },
        { label: "Compliance", value: catCounts.compliance },
        { label: "Clarifications", value: catCounts.clarification },
        { label: "Scope Expansion", value: catCounts.scope_expansion },
        { label: "Strategic Hold", value: groupCount("hold") },
        { label: "Internal Items", value: groupCount("internal") },
      ];

      // Category descriptions used for the legend
      const TONE_DESC: Record<Tone, string> = {
        contradiction: "Conflicting requirements between two or more documents that must be resolved before pricing.",
        risk_concern: "Clauses or structures that transfer undue financial or performance risk to the contractor.",
        quantitative_gap: "Missing data, undefined ranges, or ambiguous workload figures that prevent accurate pricing.",
        compliance: "Regulatory or certification requirements with unclear scope or applicability.",
        drafting_error: "Apparent typographical errors, obsolete references, or placeholder language requiring correction.",
        clarification: "Ambiguous requirements where the Government's intent is unclear and multiple interpretations are plausible.",
        scope_expansion: "Provisions that could significantly expand contract scope without a defined pricing mechanism.",
        strategic: "Questions held for strategic advantage — not submitted to the Government.",
        internal: "Items flagged for internal capture planning only.",
        neutral: "General questions that do not fit the standard categories.",
      };

      const clientName = (sol.client as { name?: string } | null)?.name ?? "INVERNESS";
      const firmName = (options?.branding?.headerText as string | undefined) || clientName || "INVERNESS";

      const sections: any[] = [];

      if (isClientQ) {
        // Cover page
        sections.push({
          id: "cover",
          heading: "Cover",
          level: 1,
          blocks: [{
            kind: "coverHero",
            firm: firmName,
            title: sol.title ?? "Strategic Questionnaire",
            solicitationNumber: sol.solicitation_number ?? undefined,
            agency: sol.issuing_agency ?? undefined,
            generatedAt: new Date().toISOString(),
            confidential: true,
          }],
        });

        // Executive Summary
        const submittedCount = groupCount("ask");
        const usedCategories = (Object.keys(catCounts) as Tone[]).filter((t) => catCounts[t] > 0).length;
        const execSummary = sol.ai_summary
          ? String(sol.ai_summary)
          : `A total of ${all.length} question${all.length === 1 ? "" : "s"} ${all.length === 1 ? "was" : "were"} identified across ${usedCategories} issue categor${usedCategories === 1 ? "y" : "ies"} following a comprehensive review of the draft solicitation package${sol.solicitation_number ? ` for ${sol.solicitation_number}` : ""}. ${submittedCount} ${submittedCount === 1 ? "is" : "are"} recommended for submission to the agency. An additional ${groupCount("hold")} question${groupCount("hold") === 1 ? " has" : "s have"} been withheld for strategic advantage, and ${groupCount("internal")} item${groupCount("internal") === 1 ? " is" : "s are"} flagged for internal capture planning only.`;

        sections.push({
          id: "exec_summary",
          heading: "Executive Summary",
          level: 1,
          blocks: [{ kind: "paragraph", text: execSummary }],
        });

        // At a Glance (stats strip)
        sections.push({
          id: "at_a_glance",
          heading: "At a Glance",
          level: 1,
          blocks: [{ kind: "statsStrip", tiles: statsTiles }],
        });

        // Issue Category Legend
        const legendItems = TONE_ORDER
          .filter((t) => t !== "neutral" && t !== "strategic" && t !== "internal" && catCounts[t] > 0)
          .map((t) => ({ tone: t, label: TONE_LABEL[t], count: catCounts[t], description: TONE_DESC[t] }));
        if (legendItems.length) {
          sections.push({
            id: "legend",
            heading: "Issue Category Legend",
            level: 1,
            blocks: [{ kind: "categoryLegend", items: legendItems }],
          });
        }

        // Quick Reference Index — all submitted questions
        const submittedRows = groups.ask;
        if (submittedRows.length) {
          let idx = 0;
          const indexRows = submittedRows.map((q) => {
            idx++;
            const tone = toneOf(q.category);
            const topic = (q.question_text || "").replace(/\s+/g, " ").trim();
            const truncated = topic.length > 140 ? topic.slice(0, 137) + "…" : topic;
            return {
              index: idx,
              tone,
              categoryLabel: TONE_LABEL[tone],
              source: q.source_citation ?? "—",
              topic: truncated,
            };
          });
          sections.push({
            id: "index",
            heading: "Quick Reference Index",
            level: 1,
            blocks: [{ kind: "indexTable", rows: indexRows }],
          });
        }
      } else {
        // Original questions_brief overview
        sections.push({
          id: "overview",
          heading: "Report Overview",
          level: 1,
          blocks: [{ kind: "statsStrip", tiles: statsTiles }],
        });
      }

      let qCounter = 0;
      for (const def of sectionDef) {
        const rows = groups[def.key];
        if (!rows.length) continue;
        const blocks: any[] = [{ kind: "paragraph", text: def.intro(rows.length) }];

        if (def.subgroup) {
          // group rows by tone, in TONE_ORDER
          const byTone = new Map<Tone, typeof rows>();
          for (const r of rows) {
            const t = toneOf(r.category);
            if (!byTone.has(t)) byTone.set(t, [] as any);
            (byTone.get(t) as any).push(r);
          }
          for (const tone of TONE_ORDER) {
            const subset = byTone.get(tone);
            if (!subset || !subset.length) continue;
            blocks.push({ kind: "categoryBand", title: TONE_TITLE[tone], count: subset.length, tone });
            for (const q of subset) {
              qCounter++;
              blocks.push({
                kind: "questionCard",
                index: qCounter,
                tone,
                categoryLabel: TONE_LABEL[tone],
                question: q.question_text,
                rationale: q.question_rationale ?? undefined,
                source: q.source_citation ?? undefined,
                agencyResponse: q.agency_response ?? undefined,
              });
            }
          }
        } else {
          // hold/internal: cards only, restart numbering for each section
          let idx = 0;
          for (const q of rows) {
            idx++;
            const tone = def.key === "hold" ? "strategic" : "internal";
            blocks.push({
              kind: "questionCard",
              index: idx,
              tone,
              categoryLabel: TONE_LABEL[tone],
              question: q.question_text,
              rationale: q.question_rationale ?? undefined,
              source: q.source_citation ?? undefined,
              agencyResponse: q.agency_response ?? undefined,
            });
          }
        }

        sections.push({ id: def.key, heading: def.heading, level: 1, blocks });
      }

      const includeCitationsQ = options?.includeCitations !== false;
      let citationsQ: any[] = [];
      if (includeCitationsQ) {
        const seen = new Set<string>();
        for (const q of all) {
          const cite = (q.source_citation ?? "").trim();
          if (!cite || seen.has(cite)) continue;
          seen.add(cite);
          const pageMatch = cite.match(/p(?:age|\.)?\s*(\d+)/i);
          const sectionMatch = cite.match(/§\s*([\w.\-]+)|section\s+([\w.\-]+)/i);
          citationsQ.push({
            id: `C${citationsQ.length + 1}`,
            document: cite.split(/[§,;]/)[0].trim() || cite,
            section: sectionMatch ? (sectionMatch[1] || sectionMatch[2]) : undefined,
            page: pageMatch ? Number(pageMatch[1]) : undefined,
            quote: q.source_quote ?? undefined,
          });
          if (citationsQ.length >= 20) break;
        }
      }

      const qbLens = await buildClientLens(
        (sol as { client_id?: string | null }).client_id ?? null,
        { topic: "report", query: `${(sol as any)?.title ?? ""} ${(sol as any)?.issuing_agency ?? ""} strategic questions brief`, override: (sol as { lens_overrides?: Record<string, unknown> | null }).lens_overrides ?? null },
      );

      const content = {
        title: `${isClientQ ? "Client Strategic Questionnaire" : "Strategic Questions Brief"} – ${sol.title}`,
        subtitle: sol.solicitation_number ?? null,
        generatedAt: new Date().toISOString(),
        meta: {
          solicitation_number: sol.solicitation_number,
          agency: sol.issuing_agency,
          client: (sol.client as { name?: string } | null)?.name,
          contract_type: sol.contract_type,
          total_questions: all.length,
        },
        sections,
        citations: citationsQ,
        options: options ?? {},
        branding: options?.branding ?? null,
        lens: qbLens.snapshot,
      };

      console.log(`[generate-report] sol=${solicitationId} type=questions_brief deterministic count=${all.length}`);

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
    }

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

    const reportSol = (ctx as { solicitation?: { client_id?: string | null; lens_overrides?: Record<string, unknown> | null } }).solicitation
      ?? (ctx as { sol?: { client_id?: string | null; lens_overrides?: Record<string, unknown> | null } }).sol;
    const lens = await buildClientLens(reportSol?.client_id ?? null, { topic: "report", query: `${sol?.title ?? ""} ${sol?.issuing_agency ?? ""} ${((sol?.ai_summary ?? "") + "").slice(0, 600)} report:${reportType}`, override: reportSol?.lens_overrides ?? null });
    const baseSystem = `You are an expert proposal strategist generating professional client deliverables. ${prompt}`;
    const parsed = await callAiTool({
      functionName: "generate-report",
      system: lens.promptBlock ? `${lens.promptBlock}\n\n${baseSystem}` : baseSystem,
      user: userPrompt,
      tool: SCHEMA,
    }) as Record<string, any>;

    // Normalize blocks: AI returns bullets/steps `items` as object arrays,
    // but our bullets renderer expects string[].
    const STRUCTURED = new Set(["recommendation", "key success factors", "next steps"]);
    const normalizeSections = (sections: any[] = []) => sections.map((s) => {
      const headingKey = String(s.heading ?? "").trim().toLowerCase();
      if (STRUCTURED.has(headingKey)) {
        const kinds = Array.isArray(s.blocks) ? s.blocks.map((b: any) => b?.kind) : [];
        const hasParagraphOnly = kinds.length > 0 && kinds.every((k: string) => k === "paragraph" || k === "bullets" && headingKey !== "key success factors");
        if (hasParagraphOnly && headingKey !== "key success factors") {
          console.warn(`[generate-report] section "${s.heading}" returned paragraph blocks; expected structured block.`);
        }
      }
      const blocks = Array.isArray(s.blocks) ? s.blocks.map((b: any) => {
        if (!b || typeof b !== "object") return b;
        if (b.kind === "bullets" && Array.isArray(b.items)) {
          return { ...b, items: b.items.map((it: any) => typeof it === "string" ? it : (it?.text ?? "")) };
        }
        if (b.kind === "steps" && Array.isArray(b.items)) {
          return { ...b, items: b.items.map((it: any) => ({ title: it?.title ?? "", detail: it?.detail ?? "" })) };
        }
        return b;
      }) : undefined;
      return blocks ? { ...s, blocks } : s;
    });

    // Backfill citations from context if AI returned none
    let citations = Array.isArray(parsed.citations) ? parsed.citations : [];
    if (includeCitations && citations.length === 0) {
      const sourced: Array<{ source_citation?: string | null; source_quote?: string | null }> = [
        ...(ctx.risks ?? []),
        ...(ctx.opportunities ?? []),
        ...(ctx.questions ?? []),
      ];
      const seen = new Set<string>();
      const synth: any[] = [];
      for (const row of sourced) {
        const cite = (row.source_citation ?? "").trim();
        if (!cite || seen.has(cite)) continue;
        seen.add(cite);
        const pageMatch = cite.match(/p(?:age|\.)?\s*(\d+)/i);
        const sectionMatch = cite.match(/§\s*([\w.\-]+)|section\s+([\w.\-]+)/i);
        synth.push({
          id: `C${synth.length + 1}`,
          document: cite.split(/[§,;]/)[0].trim() || cite,
          section: sectionMatch ? (sectionMatch[1] || sectionMatch[2]) : undefined,
          page: pageMatch ? Number(pageMatch[1]) : undefined,
          quote: row.source_quote ?? undefined,
        });
        if (synth.length >= 8) break;
      }
      if (synth.length === 0 && (ctx.documents ?? []).length) {
        for (const d of (ctx.documents ?? []).slice(0, 5)) {
          synth.push({ id: `C${synth.length + 1}`, document: d.file_name });
        }
      }
      citations = synth;
    }
    if (!includeCitations) citations = [];

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
      sections: normalizeSections(parsed.sections),
      citations,
      options: options ?? {},
      branding: options?.branding ?? null,
      lens: lens.snapshot,
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
