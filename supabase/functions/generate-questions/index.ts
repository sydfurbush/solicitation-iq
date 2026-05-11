import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

import { callAiTool } from "../_shared/aiClient.ts";
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const SYSTEM_PROMPT = `You are an expert federal proposal strategist performing an EXHAUSTIVE strategic question review of a government solicitation package. Your job is to surface EVERY question a sophisticated bidder would want answered before submitting a proposal — across ALL provided documents (PWS, Technical Exhibits, attachments, instructions, evaluation criteria, CLINs, etc.).

Be thorough. It is far better to surface a borderline question than to omit a real one. Generate as many questions as the documents warrant — 60, 80, 100+ is normal for a full draft RFP package.

For EACH question, you MUST:
- Provide the exact question text as it would be submitted to the agency (professional, neutral tone).
- Explain WHY it matters strategically.
- Cite the EXACT source: document filename, section number, page number, and a verbatim quote (up to 280 chars).
- For cross-document questions, ALSO cite the second source in conflict_with_document / conflict_with_section.
- Recommend ASK, HOLD (strategic — don't tip our hand), MONITOR, or INTERNAL_ONLY.
- Assign a priority score 1-100.
- Choose the most specific category from the list below.

CATEGORIES — use the most specific one that fits:
- drafting_error: Typos, anachronisms, outdated dates, broken/incorrect regulatory citations, duplicate or near-duplicate language across sections, internally contradictory sentences. Examples: "RFO FAR 12.105" (not a real cite), "25/Nov/13" (decade-old date), "Department of War" (renamed 1947), "no later than 5 days upon hiring prior to commencement" (self-contradictory).
- contradiction: A real conflict BETWEEN two sources — PWS vs. Technical Exhibit, Section X vs. Section Y, CLIN vs. PWS schedule, KPI threshold vs. task requirement, place-of-performance list vs. staffing rule. ALWAYS name BOTH sources in conflict_with_document/conflict_with_section.
- quantitative_gap: A numeric requirement (percentage, day count, headcount, dollar cap, ratio, threshold) is stated but its BASIS, FLOOR, CAP, or ADJUSTMENT MECHANISM is missing. Examples: "Tier 1: 50%, Tier 2: 40%" with no basis; financial liability with no cap; education-experience substitution with no floor.
- compliance: FAR/DFARS/agency-specific regulatory or certification questions; security clearance, background-investigation timing vs. phase-in; foreign-law compliance burdens.
- risk_concern: Cost/risk allocation gaps — who bears cost if assumption X fails; force-majeure/disaster/disruption coverage; vacancy gaps in key personnel; performance standards during transition.
- scope_expansion: Opportunities to grow scope, add value-add services, surge capacity, optional CLINs.
- strategic: Questions to HOLD that reveal incumbent advantages, evaluation-criteria interpretation, pricing-structure flexibility.
- clarification: Genuine ambiguity that doesn't fit the more specific buckets above.
- other: Only if truly none of the above apply.

CRITICAL TECHNIQUES — apply ALL of these systematically:
1. CROSS-REFERENCE every Technical Exhibit against the PWS section it supports. Conflicts in KPI thresholds, deliverable timelines, place-of-performance counts, staffing minimums, and quantities are extremely common — flag every one.
2. SCAN for drafting errors: search every regulatory citation for validity; flag any date older than ~3 years; flag any agency or program name that may be anachronistic; flag duplicate/near-duplicate paragraphs.
3. For every NUMBER (%, days, headcount, $, ratio), ask: what is the basis? what if actuals differ? is there a cap/floor/adjustment?
4. For every CONTRACTOR OBLIGATION, ask: who pays if assumption X breaks? what is the consequence of delay?
5. For every KEY-PERSONNEL or LOCATION rule, ask: what about vacancies, simultaneous-presence requirements, OCONUS variations?
6. For every SCHEDULE or PHASE-IN/OUT timing, ask: is it feasible given upstream dependencies (background checks, clearances, training)?

EXAMPLE — cross-document contradiction:
{
  "question_text": "PWS Section 5.10.6 establishes a Virtual Center wait-time standard, while Technical Exhibit A KPI #16 establishes a different threshold for the same metric. Which standard governs performance evaluation, and will the conflicting language be reconciled before final RFP release?",
  "category": "contradiction",
  "source_document": "PWS.pdf", "source_section": "5.10.6",
  "conflict_with_document": "Technical Exhibit A.pdf", "conflict_with_section": "KPI #16",
  ...
}

EXAMPLE — drafting error:
{
  "question_text": "Section 1.5.1 references 'RFO FAR 12.105,' which is not a recognized FAR citation. Is this a typographical error, and what is the intended reference?",
  "category": "drafting_error",
  ...
}

Return ONLY the JSON via the tool call. Do not narrate.`;

const SCHEMA = {
  name: "generate_strategic_questions",
  description: "Exhaustive strategic questions for a government solicitation package",
  parameters: {
    type: "object",
    properties: {
      questions: {
        type: "array",
        items: {
          type: "object",
          properties: {
            question_text: { type: "string" },
            category: {
              type: "string",
              enum: [
                "clarification", "strategic", "scope_expansion", "risk_concern",
                "compliance", "drafting_error", "contradiction", "quantitative_gap", "other",
              ],
            },
            recommendation: { type: "string", enum: ["ask", "hold", "monitor", "internal_only"] },
            priority: { type: "number" },
            question_rationale: { type: "string" },
            strategic_advantage_notes: { type: "string" },
            potential_answer_insight: { type: "string" },
            source_document: { type: "string" },
            source_section: { type: "string" },
            source_page: { type: "number" },
            source_quote: { type: "string" },
            conflict_with_document: { type: "string", description: "For contradiction category: the second document in conflict" },
            conflict_with_section: { type: "string", description: "For contradiction category: the section in the second document" },
          },
          required: ["question_text", "category", "recommendation", "priority", "question_rationale"],
        },
      },
    },
    required: ["questions"],
  },
};

const VALID_CATEGORIES = new Set([
  "clarification", "strategic", "scope_expansion", "risk_concern",
  "compliance", "drafting_error", "contradiction", "quantitative_gap", "other",
]);

// Build a single document block: TOC + body windows for each section.
// Long sections keep head + tail so trailing references survive.
function buildDocBlock(
  doc: { id: string; file_name: string },
  sections: Array<{ section_number: string | null; section_title: string | null; content: string | null; page_start: number | null }>,
  budget: number,
): { text: string; used: number } {
  const toc = sections
    .map((s) => `  ${s.section_number ?? "?"}  ${s.section_title ?? ""} (p.${s.page_start ?? "?"})`)
    .join("\n");
  const header = `\n\n=== DOCUMENT: ${doc.file_name} ===\n--- TABLE OF CONTENTS ---\n${toc}\n--- BODY ---\n`;
  let used = header.length;
  const parts: string[] = [header];
  const PER_SECTION_HEAD = 2400;
  const PER_SECTION_TAIL = 1200;
  for (const s of sections) {
    if (used >= budget) break;
    const content = (s.content ?? "").trim();
    if (!content) continue;
    let body: string;
    if (content.length <= PER_SECTION_HEAD + PER_SECTION_TAIL + 40) {
      body = content;
    } else {
      body = content.slice(0, PER_SECTION_HEAD) + "\n…[truncated]…\n" + content.slice(-PER_SECTION_TAIL);
    }
    const remaining = budget - used;
    if (body.length > remaining) body = body.slice(0, Math.max(0, remaining - 200)) + "\n…[truncated]…";
    const chunk = `\n[§${s.section_number ?? "?"} ${s.section_title ?? ""} | p.${s.page_start ?? "?"}]\n${body}\n`;
    parts.push(chunk);
    used += chunk.length;
  }
  return { text: parts.join(""), used };
}

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
    const docByName = new Map<string, string>();
    documents.forEach((d) => docByName.set(d.file_name, d.id));

    const { data: sections } = await supabase
      .from("document_sections")
      .select("document_id, section_number, section_title, content, page_start, sort_order")
      .in("document_id", docIds)
      .order("sort_order", { ascending: true });

    const sectionsByDoc = new Map<string, typeof sections>();
    for (const d of documents) sectionsByDoc.set(d.id, []);
    for (const s of sections ?? []) sectionsByDoc.get(s.document_id)?.push(s);

    // Distribute a generous total budget across documents proportionally
    // to their section count, so big PWS docs get more room than 1-page exhibits.
    const TOTAL_BUDGET = 240_000;
    const totalSections = (sections ?? []).length || 1;
    let docBlocks = "";
    let totalUsed = 0;
    for (const d of documents) {
      const ds = sectionsByDoc.get(d.id) ?? [];
      const share = Math.max(8_000, Math.floor((ds.length / totalSections) * TOTAL_BUDGET));
      const remaining = TOTAL_BUDGET - totalUsed;
      const budget = Math.min(share, remaining);
      if (budget < 1_000) break;
      const { text, used } = buildDocBlock(d, ds, budget);
      docBlocks += text;
      totalUsed += used;
    }

    const focusText = focusAreas?.length ? `\n\nFOCUS AREAS (emphasize these but do NOT skip other issues): ${focusAreas.join(", ")}` : "";
    const summaryText = sol?.ai_summary ? `\n\nEXISTING ANALYSIS SUMMARY:\n${sol.ai_summary}` : "";
    const userPrompt = `Solicitation: ${sol?.title ?? "Untitled"}${summaryText}${focusText}\n${docBlocks}\n\nGenerate the FULL exhaustive list of strategic questions for this package now.`;

    console.log(`[generate-questions] sol=${solicitationId} docs=${documents.length} sections=${(sections ?? []).length} promptChars=${userPrompt.length} regenerate=${!!regenerate}`);

    const work = (async () => {
      try {
        const parsedQ = await callAiTool({
          functionName: "generate-questions",
          system: SYSTEM_PROMPT,
          user: userPrompt,
          tool: SCHEMA,
        }) as Record<string, any>;
        const { questions } = parsedQ;

        const rows = (questions ?? []).map((q: Record<string, unknown>) => {
          const sourceDocId = q.source_document ? docByName.get(q.source_document as string) : null;
          let category = (q.category as string) ?? "other";
          if (!VALID_CATEGORIES.has(category)) category = "other";
          const conflictDoc = q.conflict_with_document as string | undefined;
          const conflictSec = q.conflict_with_section as string | undefined;
          const baseCitation = q.source_section ? `Section ${q.source_section}${q.source_page ? `, p.${q.source_page}` : ""}` : null;
          const conflictCitation = conflictDoc ? ` ↔ ${conflictDoc}${conflictSec ? ` §${conflictSec}` : ""}` : "";
          return {
            solicitation_id: solicitationId,
            question_text: q.question_text as string,
            question_rationale: (q.question_rationale as string) ?? null,
            category,
            recommendation: (q.recommendation as string) ?? "monitor",
            priority: Math.max(1, Math.min(100, Math.round(Number(q.priority) || 50))),
            source_document_id: sourceDocId ?? null,
            source_citation: baseCitation ? `${baseCitation}${conflictCitation}` : (conflictCitation || null),
            source_quote: (q.source_quote as string) ?? null,
            strategic_advantage_notes: (q.strategic_advantage_notes as string) ?? null,
            potential_answer_insight: (q.potential_answer_insight as string) ?? null,
            is_ai_generated: true,
          };
        });

        if (rows.length === 0) {
          console.warn(`[generate-questions] AI returned 0 questions for sol=${solicitationId}; preserving existing`);
          return;
        }
        // Only delete prior AI rows AFTER we have a non-empty result, so a failed
        // run never wipes the prior baseline.
        if (regenerate) {
          const { error: delErr } = await supabase
            .from("strategic_questions")
            .delete()
            .eq("solicitation_id", solicitationId)
            .eq("is_ai_generated", true);
          if (delErr) console.error("[generate-questions] delete error", delErr);
        }
        const { error: insErr } = await supabase.from("strategic_questions").insert(rows);
        if (insErr) console.error("[generate-questions] insert error", insErr);
        else console.log(`[generate-questions] inserted ${rows.length} questions for sol=${solicitationId}`);
      } catch (err) {
        console.error("[generate-questions] background error", err);
      }
    })();
    // @ts-ignore - EdgeRuntime is provided by Supabase edge runtime
    if (typeof EdgeRuntime !== "undefined") EdgeRuntime.waitUntil(work);

    return new Response(JSON.stringify({ status: "processing" }), {
      status: 202, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("[generate-questions] error", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : String(e) }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
