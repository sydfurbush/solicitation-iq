import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

import { callAiTool } from "../_shared/aiClient.ts";
import { buildClientLens } from "../_shared/clientLens.ts";
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const SYSTEM_PROMPT = `You are an expert government contracting analyst with 20+ years of experience reviewing federal RFPs, RFQs, and IDIQ solicitations. Your job is to extract strategic intelligence that helps a contractor decide whether to bid and how to win.

You will receive excerpts from one or more solicitation documents and must produce a single JSON object that strictly matches the provided schema. Always:
- When a "KNOWN FACTS" block is provided, treat those values as AUTHORITATIVE. Do NOT restate them with different values, even if the document text suggests otherwise. Cover sheets and SF1449 templates often contain misleading boilerplate (e.g. a "WOMEN-OWNED SMALL BUSINESS (WOSB) SOLICITATION" header) that is NOT the actual set-aside designation.
- The executive_summary MUST be consistent with KNOWN FACTS. If the documents conflict with a known fact, mention the conflict in risk_signals instead of changing the summary.
- Cite EXACT sections (e.g. "L.5.2", "4.2.1") and page numbers when available.
- Quote source text verbatim in the "quote" field (max 280 chars).
- Use priority levels: critical (must comply or no-bid), high, medium, low.

REQUIREMENT EXTRACTION PRIORITY (read carefully):
1. ALWAYS extract requirements from Section L (Instructions to Offerors), Section M (Evaluation), and any section titled "Proposal Submission", "Instructions to Offerors", "Evaluation", "Basis for Award", "Eligibility", "Minimum Requirements", or "BPA/IDIQ Award". These sections contain bid-eligibility GATES.
2. Every must-submit rule, minimum-scope rule (e.g. "must propose on X and at least one other Y"), page limit, proposal volume requirement, format gate, and pass/fail criterion is a CRITICAL requirement and MUST appear in key_requirements with category="submission" and priority="critical". Do not omit these in favor of technical/staffing items.
3. Then extract technical, staffing, management, and compliance requirements.
4. Return up to 25 key_requirements, ranked by importance (submission/eligibility gates first, then critical compliance, then technical/staffing).
5. If a field cannot be determined from the documents, use null or an empty array.
6. Confidence score is 0.0-1.0 reflecting how complete the source material is.

Output ONLY the JSON object, no prose.`;

const ANALYSIS_SCHEMA = {
  name: "solicitation_analysis",
  description: "Structured analysis of a government solicitation",
  parameters: {
    type: "object",
    properties: {
      executive_summary: { type: "string" },
      key_requirements: {
        type: "array",
        items: {
          type: "object",
          properties: {
            id: { type: "string" },
            text: { type: "string" },
            priority: { type: "string", enum: ["critical", "high", "medium", "low"] },
            category: { type: "string", enum: ["submission", "technical", "management", "staffing", "compliance", "other"] },
            source: {
              type: "object",
              properties: {
                document: { type: "string" },
                section: { type: "string" },
                page: { type: "number" },
                quote: { type: "string" },
              },
            },
          },
          required: ["id", "text", "priority", "category"],
        },
      },
      evaluation_factors: {
        type: "array",
        items: {
          type: "object",
          properties: {
            name: { type: "string" },
            weight: { type: "number" },
            description: { type: "string" },
            subfactors: { type: "array", items: { type: "string" } },
            source: {
              type: "object",
              properties: {
                document: { type: "string" },
                section: { type: "string" },
                page: { type: "number" },
                quote: { type: "string" },
              },
            },
          },
          required: ["name"],
        },
      },
      incumbent_info: {
        type: "object",
        properties: {
          detected: { type: "boolean" },
          name: { type: "string" },
          contract_number: { type: "string" },
          indicators: { type: "array", items: { type: "string" } },
        },
      },
      contract_structure: {
        type: "object",
        properties: {
          type: { type: "string" },
          base_period: { type: "string" },
          option_periods: { type: "string" },
          ceiling_value: { type: "string" },
          clins_detected: { type: "boolean" },
          pricing_structure: { type: "string" },
        },
      },
      risk_signals: { type: "array", items: { type: "string" } },
      opportunity_signals: { type: "array", items: { type: "string" } },
      confidence_score: { type: "number" },
    },
    required: ["executive_summary", "key_requirements", "evaluation_factors", "confidence_score"],
  },
};

function buildKnownFactsBlock(sol: Record<string, any> | null): string {
  if (!sol) return "";
  const lines: string[] = [];
  const add = (label: string, val: unknown) => {
    if (val === null || val === undefined || val === "") return;
    lines.push(`- ${label}: ${val}`);
  };
  add("Set-Aside", sol.set_aside);
  add("Solicitation #", sol.solicitation_number);
  add("Issuing Agency", sol.issuing_agency);
  add("Agency Type", sol.agency_type);
  add("Contract Type", sol.contract_type);
  add("Incumbent", sol.incumbent_name);
  add("Incumbent Contract #", sol.incumbent_contract_number);
  add("Release Date", sol.release_date);
  add("Questions Due", sol.questions_due_date);
  add("Proposal Due", sol.proposal_due_date);
  add("Period of Performance Start", sol.period_of_performance_start);
  add("Period of Performance End", sol.period_of_performance_end);
  if (sol.estimated_value_low || sol.estimated_value_high) {
    add("Estimated Value", `${sol.estimated_value_low ?? "?"} - ${sol.estimated_value_high ?? "?"}`);
  }
  add("Client", sol.client?.name);
  if (!lines.length) return "";
  return `=== KNOWN FACTS (authoritative — do not contradict) ===\n${lines.join("\n")}\n\n`;
}

function buildUserPrompt(
  knownFacts: string,
  documents: Array<{ name: string; sections: Array<{ section_number: string | null; section_title: string | null; content: string; page_start: number | null }>; entities: Array<{ entity_type: string; entity_value: string }> }>,
) {
  // Soft total budget across all docs. Gemini Pro reliably handles ~180k chars;
  // beyond that the gateway sometimes returns empty responses.
  const TOTAL_CHAR_BUDGET = 180_000;
  const perDocBudget = Math.max(8_000, Math.floor(TOTAL_CHAR_BUDGET / Math.max(1, documents.length)));

  const docBlocks = documents.map((d) => {
    let remaining = perDocBudget;
    const parts: string[] = [];
    for (const s of d.sections) {
      if (remaining <= 0) break;
      const slice = s.content.slice(0, Math.min(4000, remaining));
      parts.push(`[Section ${s.section_number ?? "?"} - ${s.section_title ?? "Untitled"} | p.${s.page_start ?? "?"}]\n${slice}`);
      remaining -= slice.length;
    }
    const sectionText = parts.join("\n\n");
    const entityText = d.entities.length
      ? `\nKey extracted entities:\n${d.entities.slice(0, 60).map((e) => `- ${e.entity_type}: ${e.entity_value}`).join("\n")}`
      : "";
    return `=== DOCUMENT: ${d.name} ===\n${sectionText}${entityText}`;
  });
  return `${knownFacts}Analyze the following solicitation documents and produce the JSON analysis.\n\n${docBlocks.join("\n\n")}`;
}

const SET_ASIDE_TERMS: Record<string, RegExp> = {
  "8(a)": /\b8\s*\(\s*a\s*\)/i,
  "WOSB": /\bWOSB\b|women[-\s]?owned\s+small\s+business/i,
  "EDWOSB": /\bEDWOSB\b/i,
  "SDVOSB": /\bSDVOSB\b|service[-\s]?disabled\s+veteran/i,
  "HUBZone": /\bHUB[-\s]?Zone\b/i,
  "SDB": /\bSDB\b|small\s+disadvantaged\s+business/i,
  "Total Small Business": /total\s+small\s+business/i,
};

function validateSummary(summary: string, sol: Record<string, any> | null) {
  const warnings: Array<{ field: string; expected: string; found: string }> = [];
  if (!summary || !sol) return warnings;
  const expected = sol.set_aside as string | null;
  if (expected) {
    for (const [label, rx] of Object.entries(SET_ASIDE_TERMS)) {
      if (label === expected) continue;
      if (rx.test(summary)) {
        warnings.push({ field: "set_aside", expected, found: label });
      }
    }
  }
  return warnings;
}

const admin = () => createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

async function updateJob(jobId: string, patch: Record<string, unknown>) {
  try {
    await admin().from("analysis_jobs").update(patch).eq("id", jobId);
  } catch (e) {
    console.warn("[analyze-solicitation] job update failed", jobId, e);
  }
}

async function runAnalysis(jobId: string, solicitationId: string, analysisType: string) {
  const supabase = admin();
  try {
    await updateJob(jobId, { status: "running", progress_step: "loading_documents", started_at: new Date().toISOString() });

    const { data: solicitation } = await supabase
      .from("solicitations")
      .select(
        "set_aside, solicitation_number, issuing_agency, agency_type, contract_type, incumbent_name, incumbent_contract_number, release_date, questions_due_date, proposal_due_date, period_of_performance_start, period_of_performance_end, estimated_value_low, estimated_value_high, client_id, lens_overrides, client:clients(name)",
      )
      .eq("id", solicitationId)
      .maybeSingle();

    const { data: documents, error: docErr } = await supabase
      .from("documents")
      .select("id, file_name, status")
      .eq("solicitation_id", solicitationId)
      .is("deleted_at", null)
      .in("status", ["parsed", "analyzed"]);
    if (docErr) throw docErr;
    if (!documents || documents.length === 0) {
      throw new Error("No processed documents available. Upload and process documents first.");
    }

    const docIds = documents.map((d) => d.id);

    const { data: sections } = await supabase
      .from("document_sections")
      .select("document_id, section_number, section_title, content, page_start, sort_order")
      .in("document_id", docIds)
      .order("sort_order", { ascending: true });

    const { data: entities } = await supabase
      .from("extracted_entities")
      .select("document_id, entity_type, entity_value")
      .in("document_id", docIds);

    const docPayload = documents.map((d) => ({
      name: d.file_name,
      sections: (sections ?? []).filter((s) => s.document_id === d.id).slice(0, 40),
      entities: (entities ?? []).filter((e) => e.document_id === d.id),
    }));

    const knownFacts = buildKnownFactsBlock(solicitation as Record<string, any> | null);
    const userPrompt = buildUserPrompt(knownFacts, docPayload);

    console.log(`[analyze-solicitation] job=${jobId} sol=${solicitationId} type=${analysisType} docs=${documents.length} promptChars=${userPrompt.length}`);

    await updateJob(jobId, { progress_step: "calling_model" });

    const lens = await buildClientLens((solicitation as { client_id?: string | null } | null)?.client_id ?? null, {
      topic: "analysis",
      query: `${(solicitation as any)?.title ?? ""} ${(solicitation as any)?.issuing_agency ?? ""} ${(((solicitation as any)?.ai_summary ?? "") + "").slice(0, 600)}`,
      override: ((solicitation as { lens_overrides?: Record<string, unknown> | null } | null)?.lens_overrides) ?? null,
    });

    const systemPrompt = lens.promptBlock ? `${lens.promptBlock}\n\n${SYSTEM_PROMPT}` : SYSTEM_PROMPT;
    let modelUsed = "default";
    let analysis: Record<string, any>;
    try {
      analysis = await callAiTool({
        functionName: "analyze-solicitation",
        system: systemPrompt,
        user: userPrompt,
        tool: ANALYSIS_SCHEMA,
      }) as Record<string, any>;
    } catch (e) {
      // Fallback: if the primary model returned an empty response (502 from aiClient),
      // retry once with Gemini Flash, which is more tolerant of large prompts.
      const msg = e instanceof Error ? e.message : String(e);
      const isEmpty = /empty response/i.test(msg);
      if (!isEmpty) throw e;
      console.warn(`[analyze-solicitation] primary model returned empty, falling back to gemini-2.5-flash. err=${msg}`);
      await updateJob(jobId, { progress_step: "calling_model_fallback" });
      analysis = await callAiTool({
        functionName: "analyze-solicitation",
        system: systemPrompt,
        user: userPrompt,
        tool: ANALYSIS_SCHEMA,
        modelOverride: { provider: "lovable", model: "google/gemini-2.5-flash", maxTokens: 16000 },
      }) as Record<string, any>;
      modelUsed = "google/gemini-2.5-flash (fallback)";
    }

    await updateJob(jobId, { progress_step: "persisting" });

    const validationWarnings = validateSummary(
      String(analysis.executive_summary ?? ""),
      solicitation as Record<string, any> | null,
    );
    let finalSummary = String(analysis.executive_summary ?? "");
    if (validationWarnings.length && solicitation?.set_aside) {
      finalSummary = `This solicitation is a ${solicitation.set_aside} set-aside. ${finalSummary}`;
    }

    const toArr = (v: unknown): unknown[] => {
      if (Array.isArray(v)) return v;
      if (typeof v === "string") {
        try { const p = JSON.parse(v); return Array.isArray(p) ? p : []; } catch { return []; }
      }
      return [];
    };
    const incumbent = (analysis.incumbent_info ?? {}) as Record<string, unknown>;
    if (incumbent && "indicators" in incumbent) {
      incumbent.indicators = toArr(incumbent.indicators);
    }
    const updatePayload: Record<string, unknown> = {
      ai_summary: finalSummary,
      ai_confidence_score: analysis.confidence_score ?? null,
      key_requirements: toArr(analysis.key_requirements),
      evaluation_factors: toArr(analysis.evaluation_factors),
      status: "phase_1_complete",
      metadata: {
        analysis: {
          last_analyzed_at: new Date().toISOString(),
          analysis_type: analysisType,
          document_ids: docIds,
          contract_structure: analysis.contract_structure ?? null,
          incumbent_info: incumbent,
          risk_signals: toArr(analysis.risk_signals),
          opportunity_signals: toArr(analysis.opportunity_signals),
          validation_warnings: validationWarnings,
          job_id: jobId,
          model_used: modelUsed,
        },
      },
    };
    if (incumbent.detected) {
      updatePayload.has_incumbent = true;
      if (incumbent.name) updatePayload.incumbent_name = incumbent.name;
      if (incumbent.contract_number) updatePayload.incumbent_contract_number = incumbent.contract_number;
    }

    const { error: updErr } = await supabase
      .from("solicitations")
      .update(updatePayload)
      .eq("id", solicitationId);
    if (updErr) throw updErr;

    await updateJob(jobId, {
      status: "completed",
      progress_step: null,
      completed_at: new Date().toISOString(),
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("[analyze-solicitation] job failed", jobId, msg);
    await updateJob(jobId, {
      status: "failed",
      error_message: msg,
      completed_at: new Date().toISOString(),
    });
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const { solicitationId, analysisType = "full" } = await req.json();
    if (!solicitationId) {
      return new Response(JSON.stringify({ error: "solicitationId required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Identify requester (best-effort)
    let requestedBy: string | null = null;
    const authHeader = req.headers.get("Authorization");
    if (authHeader?.startsWith("Bearer ")) {
      try {
        const supabaseAuth = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
        const { data } = await supabaseAuth.auth.getUser(authHeader.replace("Bearer ", ""));
        requestedBy = data.user?.id ?? null;
      } catch { /* ignore */ }
    }

    const { data: job, error: insErr } = await admin()
      .from("analysis_jobs")
      .insert({
        solicitation_id: solicitationId,
        analysis_type: analysisType,
        status: "queued",
        requested_by: requestedBy,
      })
      .select("id")
      .single();
    if (insErr) throw insErr;

    // @ts-ignore EdgeRuntime is available in Supabase Edge runtime
    EdgeRuntime.waitUntil(runAnalysis(job.id, solicitationId, analysisType));

    return new Response(JSON.stringify({ jobId: job.id, status: "queued" }), {
      status: 202,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("[analyze-solicitation] enqueue error", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : String(e) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
