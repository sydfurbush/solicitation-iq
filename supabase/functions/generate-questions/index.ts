import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

import { callAiTool } from "../_shared/aiClient.ts";
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const SYSTEM_PROMPT = `You are an expert federal proposal strategist performing an EXHAUSTIVE strategic question review of a government solicitation package. Your job is to surface EVERY question a sophisticated bidder would want answered before submitting a proposal — across the documents provided in this batch.

Be thorough. It is far better to surface a borderline question than to omit a real one. Generate as many questions as the documents in this batch warrant.

For EACH question, you MUST:
- Provide the exact question text as it would be submitted to the agency (professional, neutral tone).
- Explain WHY it matters strategically.
- Cite the EXACT source: document filename, section number, page number, and a verbatim quote (up to 280 chars).
- For cross-document questions, ALSO cite the second source in conflict_with_document / conflict_with_section.
- Recommend ASK, HOLD (strategic — don't tip our hand), MONITOR, or INTERNAL_ONLY.
- Assign a priority score 1-100.
- Choose the most specific category from the list below.

CATEGORIES — use the most specific one that fits:
- drafting_error: Typos, anachronisms, outdated dates, broken/incorrect regulatory citations, duplicate or near-duplicate language across sections, internally contradictory sentences.
- contradiction: A real conflict BETWEEN two sources — PWS vs. Technical Exhibit, Section X vs. Section Y, CLIN vs. PWS schedule, KPI threshold vs. task requirement, place-of-performance list vs. staffing rule. ALWAYS name BOTH sources in conflict_with_document/conflict_with_section.
- quantitative_gap: A numeric requirement (percentage, day count, headcount, dollar cap, ratio, threshold) is stated but its BASIS, FLOOR, CAP, or ADJUSTMENT MECHANISM is missing.
- compliance: FAR/DFARS/agency-specific regulatory or certification questions; security clearance, background-investigation timing vs. phase-in; foreign-law compliance burdens.
- risk_concern: Cost/risk allocation gaps — who bears cost if assumption X fails; force-majeure/disaster/disruption coverage; vacancy gaps in key personnel; performance standards during transition.
- scope_expansion: Opportunities to grow scope, add value-add services, surge capacity, optional CLINs.
- strategic: Questions to HOLD that reveal incumbent advantages, evaluation-criteria interpretation, pricing-structure flexibility.
- clarification: Genuine ambiguity that doesn't fit the more specific buckets above.
- other: Only if truly none of the above apply.

CRITICAL TECHNIQUES — apply ALL of these systematically:
1. CROSS-REFERENCE every Technical Exhibit against the PWS section it supports. Flag KPI/timing/quantity conflicts.
2. SCAN for drafting errors: invalid regulatory cites; dates older than ~3 years; anachronistic agency names; duplicate paragraphs.
3. For every NUMBER (%, days, headcount, $, ratio), ask: basis? cap/floor/adjustment?
4. For every CONTRACTOR OBLIGATION, ask: who pays if assumption X breaks? consequence of delay?
5. For every KEY-PERSONNEL or LOCATION rule, ask: vacancies, simultaneous-presence, OCONUS variations?
6. For every SCHEDULE or PHASE-IN/OUT timing, ask: feasibility given upstream dependencies?

Return ONLY the JSON via the tool call. Do not narrate.`;

const CROSS_DOC_SYSTEM_PROMPT = `You are an expert federal proposal strategist performing a CROSS-DOCUMENT contradiction review across an entire solicitation package.

You will receive: each document's table of contents and key extracted snippets (KPIs, numeric thresholds, dates, places of performance, staffing minimums, deliverable timelines).

Your ONLY job is to surface questions about CONTRADICTIONS, INCONSISTENCIES, and CROSS-DOCUMENT GAPS between two or more documents. Do NOT repeat single-document questions — those have already been generated.

For every contradiction, name BOTH sources (document + section) and quote the conflicting language. Use the "contradiction" category. Be exhaustive — borderline conflicts are valuable.

Return ONLY the JSON via the tool call.`;

const SCHEMA = {
  name: "generate_strategic_questions",
  description: "Strategic questions for the documents in this batch",
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
            conflict_with_document: { type: "string" },
            conflict_with_section: { type: "string" },
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

type Doc = { id: string; file_name: string };
type Section = {
  document_id: string;
  section_number: string | null;
  section_title: string | null;
  content: string | null;
  page_start: number | null;
  sort_order: number | null;
};

const PER_BATCH_BUDGET = 50_000; // chars of doc body per AI call (lowered from 70K for headroom)
const PER_SECTION_HEAD = 2400;
const PER_SECTION_TAIL = 1200;
const SECTION_SPLIT_THRESHOLD = 8_000; // sections larger than this are split into sub-chunks
const SUB_CHUNK_SIZE = 6_000;
const SUB_CHUNK_OVERLAP = 500;

// Split oversized sections into overlapping sub-chunks so the model sees the
// full verbatim middle of giant sections (e.g., 89K-char Site Management Manual sections)
// instead of a head+tail truncation that drops 80K chars in the middle.
function expandSections(sections: Section[]): Section[] {
  const out: Section[] = [];
  for (const s of sections) {
    const content = (s.content ?? "").trim();
    if (content.length <= SECTION_SPLIT_THRESHOLD) {
      out.push(s);
      continue;
    }
    let start = 0;
    let part = 1;
    const totalParts = Math.ceil((content.length - SUB_CHUNK_OVERLAP) / (SUB_CHUNK_SIZE - SUB_CHUNK_OVERLAP));
    while (start < content.length) {
      const end = Math.min(start + SUB_CHUNK_SIZE, content.length);
      const chunk = content.slice(start, end);
      out.push({
        ...s,
        content: chunk,
        section_title: `${s.section_title ?? ""} [part ${part}/${totalParts}]`.trim(),
      });
      if (end >= content.length) break;
      start += SUB_CHUNK_SIZE - SUB_CHUNK_OVERLAP;
      part++;
    }
  }
  return out;
}

function buildDocBlock(doc: Doc, sections: Section[], budget: number): { text: string; used: number } {
  const toc = sections
    .map((s) => `  ${s.section_number ?? "?"}  ${s.section_title ?? ""} (p.${s.page_start ?? "?"})`)
    .join("\n");
  const header = `\n\n=== DOCUMENT: ${doc.file_name} ===\n--- TABLE OF CONTENTS ---\n${toc}\n--- BODY ---\n`;
  let used = header.length;
  const parts: string[] = [header];
  for (const s of sections) {
    if (used >= budget) break;
    const content = (s.content ?? "").trim();
    if (!content) continue;
    let body =
      content.length <= PER_SECTION_HEAD + PER_SECTION_TAIL + 40
        ? content
        : content.slice(0, PER_SECTION_HEAD) + "\n…[truncated]…\n" + content.slice(-PER_SECTION_TAIL);
    const remaining = budget - used;
    if (body.length > remaining) body = body.slice(0, Math.max(0, remaining - 200)) + "\n…[truncated]…";
    const chunk = `\n[§${s.section_number ?? "?"} ${s.section_title ?? ""} | p.${s.page_start ?? "?"}]\n${body}\n`;
    parts.push(chunk);
    used += chunk.length;
  }
  return { text: parts.join(""), used };
}

// Pack documents into batches: ≤3 docs per batch, ≤PER_BATCH_BUDGET projected chars.
// Oversized docs may also be split across multiple batches via packDocSlices below.
function packBatches(docs: Doc[], sectionsByDoc: Map<string, Section[]>): Doc[][] {
  // Estimate cost per doc by total content length (capped per section).
  const cost = new Map<string, number>();
  for (const d of docs) {
    const ds = sectionsByDoc.get(d.id) ?? [];
    let c = 200; // header overhead
    for (const s of ds) {
      const len = (s.content ?? "").length;
      c += Math.min(len, PER_SECTION_HEAD + PER_SECTION_TAIL + 40) + 100;
    }
    cost.set(d.id, c);
  }
  // Sort by cost desc so big docs go in their own / small batches.
  const sorted = [...docs].sort((a, b) => (cost.get(b.id) ?? 0) - (cost.get(a.id) ?? 0));
  const batches: Doc[][] = [];
  const totals: number[] = [];
  for (const d of sorted) {
    const c = cost.get(d.id) ?? 0;
    // Big doc gets own batch.
    if (c > PER_BATCH_BUDGET * 0.7) {
      batches.push([d]);
      totals.push(c);
      continue;
    }
    // Try to fit into an existing batch with room and <3 docs.
    let placed = false;
    for (let i = 0; i < batches.length; i++) {
      if (batches[i].length < 3 && totals[i] + c <= PER_BATCH_BUDGET) {
        batches[i].push(d);
        totals[i] += c;
        placed = true;
        break;
      }
    }
    if (!placed) {
      batches.push([d]);
      totals.push(c);
    }
  }
  return batches;
}

// For an oversized single doc, slice its (already-expanded) sections into
// multiple batches so each AI call stays under the per-batch budget.
function sliceOversizedDoc(doc: Doc, sections: Section[]): Section[][] {
  const slices: Section[][] = [];
  let current: Section[] = [];
  let used = 0;
  for (const s of sections) {
    const cost = Math.min((s.content ?? "").length, PER_SECTION_HEAD + PER_SECTION_TAIL + 40) + 100;
    if (used + cost > PER_BATCH_BUDGET && current.length > 0) {
      slices.push(current);
      current = [];
      used = 0;
    }
    current.push(s);
    used += cost;
  }
  if (current.length > 0) slices.push(current);
  return slices.length > 0 ? slices : [sections];
}

function mapRows(
  questions: Array<Record<string, unknown>>,
  solicitationId: string,
  docByName: Map<string, string>,
) {
  return questions.map((q) => {
    const sourceDocId = q.source_document ? docByName.get(q.source_document as string) : null;
    let category = (q.category as string) ?? "other";
    if (!VALID_CATEGORIES.has(category)) category = "other";
    const conflictDoc = q.conflict_with_document as string | undefined;
    const conflictSec = q.conflict_with_section as string | undefined;
    const baseCitation = q.source_section
      ? `Section ${q.source_section}${q.source_page ? `, p.${q.source_page}` : ""}`
      : null;
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
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const { solicitationId, focusAreas, focusDocumentIds, regenerate, retryRunId } = await req.json();
    if (!solicitationId) {
      return new Response(JSON.stringify({ error: "solicitationId required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Reap any orphaned "running" rows for this solicitation (worker died mid-run, no terminal status was written).
    // Threshold: 8 minutes without an updated_at bump.
    try {
      const cutoff = new Date(Date.now() - 8 * 60 * 1000).toISOString();
      const { data: stale } = await supabase
        .from("question_generation_runs")
        .select("id, current_step")
        .eq("solicitation_id", solicitationId)
        .eq("status", "running")
        .lt("updated_at", cutoff);
      for (const row of stale ?? []) {
        const wasCrossDoc = (row.current_step ?? "").toLowerCase().includes("cross-document");
        await supabase
          .from("question_generation_runs")
          .update({
            status: "failed",
            cross_doc_failed: wasCrossDoc ? true : undefined,
            failed_batches: 1,
            error_message: "Run timed out (worker terminated). Retry to resume.",
            current_step: null,
            completed_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          })
          .eq("id", row.id)
          .eq("status", "running");
        console.warn(`[generate-questions] reaped stalled run=${row.id} (cross_doc=${wasCrossDoc})`);
      }
    } catch (e) {
      console.warn("[generate-questions] reaper failed (non-fatal)", e);
    }

    // Retry mode: load prior run and restrict scope to its failed batches.
    let retryDocIds: string[] | null = null;
    let retryCrossDoc = false;
    let parentRunId: string | null = null;
    let retryUnknownScope = false;
    if (retryRunId) {
      const { data: prior, error: priorErr } = await supabase
        .from("question_generation_runs")
        .select("id, solicitation_id, status, failed_doc_ids, cross_doc_failed, failed_batches")
        .eq("id", retryRunId)
        .maybeSingle();
      if (priorErr || !prior) {
        return new Response(JSON.stringify({ error: "Prior run not found" }), {
          status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (prior.solicitation_id !== solicitationId) {
        return new Response(JSON.stringify({ error: "Prior run does not match solicitation" }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      retryDocIds = (prior.failed_doc_ids ?? []) as string[];
      retryCrossDoc = !!prior.cross_doc_failed;
      parentRunId = prior.id;
      const priorFailedBatches = (prior.failed_batches ?? 0) as number;
      if (retryDocIds.length === 0 && !retryCrossDoc) {
        if (priorFailedBatches > 0) {
          // Failure scope wasn't recorded — re-run everything in append-only mode.
          retryUnknownScope = true;
          retryDocIds = null; // process all eligible docs
          retryCrossDoc = true;
          console.log(
            `[generate-questions] retry unknown scope for run=${retryRunId} (failed_batches=${priorFailedBatches}) — falling back to full re-run`,
          );
        } else {
          return new Response(JSON.stringify({ error: "Prior run has no failed batches to retry" }), {
            status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
      }
    }

    const { data: sol } = await supabase
      .from("solicitations")
      .select("title, ai_summary")
      .eq("id", solicitationId)
      .maybeSingle();

    let docQuery = supabase
      .from("documents")
      .select("id, file_name")
      .eq("solicitation_id", solicitationId)
      .is("deleted_at", null)
      .in("status", ["parsed", "analyzed"]);
    if (retryDocIds !== null) {
      if (retryDocIds.length === 0) {
        // cross-doc-only retry; load all docs (cross pass needs them) but skip per-doc batches
        // (no extra filter)
      } else {
        docQuery = docQuery.in("id", retryDocIds);
      }
    } else if (focusDocumentIds?.length) {
      docQuery = docQuery.in("id", focusDocumentIds);
    }
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

    const rawSectionsByDoc = new Map<string, Section[]>();
    for (const d of documents) rawSectionsByDoc.set(d.id, []);
    for (const s of (sections ?? []) as Section[]) rawSectionsByDoc.get(s.document_id)?.push(s);
    // Expand giant sections into overlapping sub-chunks so we don't lose middle content.
    const sectionsByDoc = new Map<string, Section[]>();
    for (const [docId, secs] of rawSectionsByDoc) sectionsByDoc.set(docId, expandSections(secs));

    const isRetry = retryRunId !== undefined && retryRunId !== null;
    const isCrossDocOnlyRetry = isRetry && !retryUnknownScope && retryDocIds !== null && retryDocIds.length === 0;
    const runCrossDoc = !isRetry || retryCrossDoc;

    // Build "work units" — each is one AI call. A normal batch contains 1-3 docs.
    // An oversized doc is split into multiple slices, each its own work unit so
    // its body is not truncated and a single chunk failure is recoverable.
    type WorkUnit = { docs: Doc[]; sectionsByDoc: Map<string, Section[]>; label: string };
    const workUnits: WorkUnit[] = [];
    if (!isCrossDocOnlyRetry) {
      const baseBatches = packBatches(documents as Doc[], sectionsByDoc);
      for (const batch of baseBatches) {
        // If single oversized doc, slice it.
        if (batch.length === 1) {
          const d = batch[0];
          const ds = sectionsByDoc.get(d.id) ?? [];
          const totalCost = ds.reduce(
            (sum, s) => sum + Math.min((s.content ?? "").length, PER_SECTION_HEAD + PER_SECTION_TAIL + 40) + 100,
            200,
          );
          if (totalCost > PER_BATCH_BUDGET) {
            const slices = sliceOversizedDoc(d, ds);
            slices.forEach((slice, idx) => {
              const m = new Map<string, Section[]>();
              m.set(d.id, slice);
              workUnits.push({
                docs: [d],
                sectionsByDoc: m,
                label: `${d.file_name} (part ${idx + 1}/${slices.length})`,
              });
            });
            continue;
          }
        }
        workUnits.push({
          docs: batch,
          sectionsByDoc,
          label: batch.map((d) => d.file_name).join(", "),
        });
      }
    }
    const batches = workUnits;
    const totalBatches = batches.length + (runCrossDoc ? 1 : 0);

    // Create the run record
    const { data: runRow } = await supabase
      .from("question_generation_runs")
      .insert({
        solicitation_id: solicitationId,
        status: "running",
        total_batches: totalBatches,
        completed_batches: 0,
        failed_batches: 0,
        inserted_count: 0,
        current_step: isRetry
          ? `Retrying ${batches.length} batch(es)${runCrossDoc ? " + cross-doc pass" : ""}`
          : `Preparing ${batches.length} document batch(es)`,
        parent_run_id: parentRunId,
      })
      .select("id")
      .single();
    const runId = runRow?.id;

    console.log(
      `[generate-questions] sol=${solicitationId} docs=${documents.length} sections=${(sections ?? []).length} batches=${batches.length} retry=${isRetry} crossDoc=${runCrossDoc} regenerate=${!!regenerate} runId=${runId} parentRunId=${parentRunId ?? "-"}`,
    );

    const focusText = focusAreas?.length
      ? `\n\nFOCUS AREAS (emphasize these but do NOT skip other issues): ${focusAreas.join(", ")}`
      : "";
    const summaryText = sol?.ai_summary ? `\n\nEXISTING ANALYSIS SUMMARY:\n${sol.ai_summary}` : "";

    const work = (async () => {
      let totalInserted = 0;
      let completed = 0;
      let failed = 0;
      // Retry mode never deletes — only appends.
      let didRegenDelete = isRetry;
      const failedDocIds: string[] = [];
      let crossDocFailed = false;

      const updateRun = async (patch: Record<string, unknown>) => {
        if (!runId) return;
        await supabase
          .from("question_generation_runs")
          .update({ ...patch, updated_at: new Date().toISOString() })
          .eq("id", runId);
      };
      for (let i = 0; i < batches.length; i++) {
        const unit = batches[i];
        const batch = unit.docs;
        const unitSections = unit.sectionsByDoc;
        const batchLabel = `${i + 1}/${batches.length}`;
        const batchNames = unit.label;
        await updateRun({ current_step: `Batch ${batchLabel}: ${batchNames}` });

        // Build prompt for this batch
        const perDocBudget = Math.floor(PER_BATCH_BUDGET / batch.length);
        let docBlocks = "";
        for (const d of batch) {
          const ds = unitSections.get(d.id) ?? [];
          const { text } = buildDocBlock(d, ds, perDocBudget);
          docBlocks += text;
        }
        const userPrompt = `Solicitation: ${sol?.title ?? "Untitled"}${summaryText}${focusText}\n\nThis is batch ${batchLabel} of ${batches.length}. Documents in this batch: ${batchNames}.\n${docBlocks}\n\nGenerate the FULL exhaustive list of strategic questions for THESE documents now.`;

        console.log(
          `[generate-questions] batch=${batchLabel} docs=[${batchNames}] promptChars=${userPrompt.length}`,
        );

        try {
          const parsed = (await callAiTool({
            functionName: "generate-questions",
            system: SYSTEM_PROMPT,
            user: userPrompt,
            tool: SCHEMA,
          })) as Record<string, any>;
          const questions = (parsed?.questions ?? []) as Array<Record<string, unknown>>;
          const rows = mapRows(questions, solicitationId, docByName);
          console.log(`[generate-questions] batch=${batchLabel} got ${rows.length} questions`);

          // Delete prior AI rows once, before inserting the FIRST successful batch.
          if (regenerate && !didRegenDelete && rows.length > 0) {
            const { error: delErr } = await supabase
              .from("strategic_questions")
              .delete()
              .eq("solicitation_id", solicitationId)
              .eq("is_ai_generated", true);
            if (delErr) console.error("[generate-questions] delete error", delErr);
            didRegenDelete = true;
          }

          if (rows.length > 0) {
            const { error: insErr } = await supabase.from("strategic_questions").insert(rows);
            if (insErr) {
              console.error(`[generate-questions] batch=${batchLabel} insert error`, insErr);
              failed++;
              for (const d of batch) failedDocIds.push(d.id);
            } else {
              totalInserted += rows.length;
              completed++;
            }
          } else {
            completed++;
          }
        } catch (err) {
          console.error(`[generate-questions] batch=${batchLabel} failed`, err);
          failed++;
          for (const d of batch) failedDocIds.push(d.id);
        }

        await updateRun({
          completed_batches: completed,
          failed_batches: failed,
          inserted_count: totalInserted,
          failed_doc_ids: failedDocIds,
        });
      }

      // Cross-document contradiction pass (skipped in retries that don't need it).
      // Tightened caps + auto-split into halves when prompt is large + heartbeat updates.
      if (runCrossDoc) {
        const PER_DOC_ENTITY_CAP = 40;
        const TOC_CAP = 25;
        const SNIPPET_CAP = 60;
        const SPLIT_PROMPT_THRESHOLD = 60_000;
        const HARD_PROMPT_CAP = 100_000;

        // Pre-fetch all entities once.
        const entitiesByDoc = new Map<string, Array<Record<string, unknown>>>();
        for (const id of docIds) entitiesByDoc.set(id, []);
        try {
          const { data: entities } = await supabase
            .from("extracted_entities")
            .select("document_id, entity_type, entity_value, page_number, context_snippet")
            .in("document_id", docIds)
            .limit(2000);
          for (const e of entities ?? []) {
            const list = entitiesByDoc.get(e.document_id as string);
            if (list && list.length < PER_DOC_ENTITY_CAP) list.push(e as Record<string, unknown>);
          }
        } catch (e) {
          console.warn("[generate-questions] cross-doc entity fetch failed (continuing)", e);
        }
        const docName = new Map<string, string>();
        documents.forEach((d) => docName.set(d.id, d.file_name));

        const buildCrossPrompt = (subset: Doc[]) => {
          let prompt = `Solicitation: ${sol?.title ?? "Untitled"}${summaryText}\n\nDocuments in package:\n`;
          for (const d of subset) {
            const ds = rawSectionsByDoc.get(d.id) ?? [];
            const toc = ds
              .map((s) => `  ${s.section_number ?? "?"}  ${s.section_title ?? ""} (p.${s.page_start ?? "?"})`)
              .slice(0, TOC_CAP)
              .join("\n");
            prompt += `\n--- ${d.file_name} ---\n${toc}\n`;
          }
          let entityCount = 0;
          let entitiesBlock = "";
          for (const d of subset) {
            const list = entitiesByDoc.get(d.id) ?? [];
            for (const e of list) {
              const snip = e.context_snippet ? ` — ${String(e.context_snippet).slice(0, SNIPPET_CAP)}` : "";
              entitiesBlock += `[${docName.get(d.id) ?? "?"} p.${e.page_number ?? "?"}] ${e.entity_type}: ${e.entity_value}${snip}\n`;
              entityCount++;
            }
          }
          if (entityCount > 0) {
            prompt += `\n\n--- KEY EXTRACTED FACTS ACROSS DOCUMENTS (${entityCount} facts, capped at ${PER_DOC_ENTITY_CAP}/doc) ---\n${entitiesBlock}`;
          }
          prompt += `\n\nFind every contradiction, inconsistency, or cross-document gap. Skip questions about a single document in isolation.`;
          if (prompt.length > HARD_PROMPT_CAP) prompt = prompt.slice(0, HARD_PROMPT_CAP) + "\n…[truncated]…";
          return { prompt, entityCount };
        };

        // Decide whether to split into two halves of documents.
        const fullProbe = buildCrossPrompt(documents as Doc[]);
        const subsets: Array<{ docs: Doc[]; label: string }> = [];
        if (fullProbe.prompt.length > SPLIT_PROMPT_THRESHOLD && documents.length >= 4) {
          const mid = Math.ceil(documents.length / 2);
          subsets.push({ docs: documents.slice(0, mid) as Doc[], label: "cross-doc pass A (docs 1–" + mid + ")" });
          subsets.push({ docs: documents.slice(mid) as Doc[], label: `cross-doc pass B (docs ${mid + 1}–${documents.length})` });
        } else {
          subsets.push({ docs: documents as Doc[], label: "cross-doc pass" });
        }

        // Bump total_batches if we split, so UI math (X/Y) stays correct.
        if (subsets.length > 1) {
          await updateRun({ total_batches: totalBatches + (subsets.length - 1) });
        }
        let anySubsetFailed = false;
        for (let si = 0; si < subsets.length; si++) {
          const sub = subsets[si];
          await updateRun({
            current_step: `Cross-document contradiction pass${subsets.length > 1 ? ` (${si + 1}/${subsets.length})` : ""}`,
          });
          try {
            const { prompt, entityCount } = buildCrossPrompt(sub.docs);
            console.log(`[generate-questions] ${sub.label} promptChars=${prompt.length} entities=${entityCount}`);

            // Heartbeat between attempts so reaper doesn't kill a slow-but-alive run.
            let parsed: Record<string, any> | null = null;
            let lastErr: unknown = null;
            for (let attempt = 1; attempt <= 2; attempt++) {
              try {
                parsed = (await callAiTool({
                  functionName: "generate-questions",
                  system: CROSS_DOC_SYSTEM_PROMPT,
                  user: prompt,
                  tool: SCHEMA,
                })) as Record<string, any>;
                lastErr = null;
                break;
              } catch (err) {
                lastErr = err;
                console.warn(`[generate-questions] ${sub.label} attempt ${attempt} failed`, err);
                if (attempt < 2) {
                  await updateRun({}); // heartbeat
                  await new Promise((r) => setTimeout(r, 1000));
                }
              }
            }
            if (lastErr || !parsed) throw lastErr ?? new Error("cross-doc pass returned no result");
            await updateRun({}); // heartbeat after AI call

            const questions = (parsed?.questions ?? []) as Array<Record<string, unknown>>;
            const rows = mapRows(questions, solicitationId, docByName);
            console.log(`[generate-questions] ${sub.label} got ${rows.length} questions`);
            if (rows.length > 0) {
              if (regenerate && !didRegenDelete) {
                await supabase
                  .from("strategic_questions")
                  .delete()
                  .eq("solicitation_id", solicitationId)
                  .eq("is_ai_generated", true);
                didRegenDelete = true;
              }
              const { error: insErr } = await supabase.from("strategic_questions").insert(rows);
              if (insErr) {
                console.error(`[generate-questions] ${sub.label} insert error`, insErr);
                failed++;
                anySubsetFailed = true;
              } else {
                totalInserted += rows.length;
                completed++;
              }
            } else {
              completed++;
            }
          } catch (err) {
            console.error(`[generate-questions] ${sub.label} failed`, err);
            failed++;
            anySubsetFailed = true;
          }
        }
        if (anySubsetFailed) crossDocFailed = true;
      }

      const finalStatus =
        failed === 0 ? "completed" : completed > 0 ? "partial" : "failed";
      if (failed > 0 && failedDocIds.length === 0 && !crossDocFailed) {
        console.warn(
          `[generate-questions] failure flags not recorded: runId=${runId} failed=${failed} — retry will fall back to full re-run`,
        );
      }
      await updateRun({
        completed_batches: completed,
        failed_batches: failed,
        inserted_count: totalInserted,
        failed_doc_ids: failedDocIds,
        cross_doc_failed: crossDocFailed,
        status: finalStatus,
        current_step: null,
        completed_at: new Date().toISOString(),
        error_message: failed > 0 ? `${failed} batch(es) failed` : null,
      });

      // If retry succeeded fully, mark the parent run as completed and clear its failure markers.
      if (isRetry && parentRunId && finalStatus === "completed") {
        await supabase
          .from("question_generation_runs")
          .update({
            status: "completed",
            failed_doc_ids: [],
            cross_doc_failed: false,
            error_message: null,
            updated_at: new Date().toISOString(),
          })
          .eq("id", parentRunId);
      }

      console.log(
        `[generate-questions] DONE sol=${solicitationId} status=${finalStatus} inserted=${totalInserted} ok=${completed} failed=${failed} retry=${isRetry}`,
      );
    })();

    // @ts-ignore - EdgeRuntime is provided by Supabase edge runtime
    if (typeof EdgeRuntime !== "undefined") EdgeRuntime.waitUntil(work);

    return new Response(JSON.stringify({ status: "processing", runId, totalBatches }), {
      status: 202, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("[generate-questions] error", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : String(e) }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
