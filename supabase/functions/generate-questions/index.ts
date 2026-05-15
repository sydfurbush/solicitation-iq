import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { callAiTool } from "../_shared/aiClient.ts";
import { buildClientLens } from "../_shared/clientLens.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const SYSTEM_PROMPT = `You are a SENIOR CAPTURE MANAGER performing a strategic question review of a federal solicitation. Your reputation depends on submitting SHARP, NON-OBVIOUS, NON-DUPLICATIVE questions. Submitting many overlapping or self-answered questions tells the Government the team did not synthesize their findings — and buries the genuinely sharp questions.

QUALITY OVER VOLUME. Fewer, better questions always win. If in doubt, leave it out.

HARD RULES — a question that violates ANY of these MUST NOT be emitted:

1. SELF-ANSWER CHECK. Re-read your own source_quote before emitting. If the quote answers the question — even partially — DROP IT. A question is only valid if the cited text leaves a MATERIAL ambiguity a contracting officer would have to resolve. Example to drop: asking "Is X required?" when the quote says "X is required."

2. BOILERPLATE FILTER. Do NOT question:
   - Standard FAR/DFARS clause incorporations by reference.
   - Representation/certification CHECKBOXES (including ones already checked or unchecked) — these are the offeror's response space, not an ambiguity.
   - "Reservation of rights" / "award without discussions but reserves the right to…" language — this is standard FAR 15.306 boilerplate.
   - Clauses that appear inside a "check all that apply" representations list — those are not active conflicting requirements.

3. CITATION ACCURACY. When citing a Class Deviation, FAR clause, DFARS clause, or PIL memo, the cited reference MUST address the topic of your question. Do NOT cite a deviation that governs a different program (e.g., a Canadian Commercial Corporation deviation) as evidence of a general sole-source provision. If you can't verify the citation matches the topic, drop the question.

4. NO DUPLICATES. Do not emit two questions whose normalized text is the same, or whose source_quote overlaps by more than ~50%. Pick the strongest framing and drop the rest.

5. TOPIC CAP — MAX 2 QUESTIONS PER TOPIC PER DOCUMENT. Topics include: Section 508 accessibility, SCA wage determinations, Privacy Act / PII safeguards, cybersecurity (NIST 800-171 / CMMC / FedRAMP), small-business subcontracting, key personnel, OCI, security clearances, BAA/TAA, Buy American, EVMS, indemnification. If a topic surfaces in many sections, CONSOLIDATE into ONE synthesis question that lists every section reference in source_quote, instead of one question per section.

For EACH question that survives the rules above, you MUST:
- question_text: professional, neutral, complete sentence ending in "?". MINIMUM 20 characters. Never return fragments like "Is the" or "The MOU mentions that".
- question_rationale: WHY it matters strategically.
- source_document, source_section, source_page, source_quote (verbatim, up to 280 chars).
- For contradictions: ALSO populate conflict_with_document / conflict_with_section.
- recommendation: ask | hold | monitor | internal_only.
- priority: 1-100.
- category: most specific from the list below.
- topic_tag: most specific topic from the enum (used for downstream consolidation).

CATEGORIES — use the most specific one that fits:
- drafting_error: Typos, anachronisms, outdated dates, broken/incorrect regulatory citations, duplicate or near-duplicate language across sections, internally contradictory sentences.
- contradiction: A real conflict BETWEEN two sources. ALWAYS name BOTH sources in conflict_with_document/conflict_with_section.
- quantitative_gap: A numeric requirement is stated but its BASIS, FLOOR, CAP, or ADJUSTMENT MECHANISM is missing.
- compliance: FAR/DFARS/agency regulatory or certification questions (only when there is a real ambiguity, NOT for boilerplate incorporations).
- risk_concern: Cost/risk allocation gaps, force-majeure, key-personnel vacancy gaps.
- scope_expansion: Opportunities to grow scope, surge capacity, optional CLINs.
- strategic: Questions to HOLD that reveal incumbent advantages or pricing flexibility.
- clarification: Genuine ambiguity that doesn't fit the more specific buckets above.
- other: Only if truly none of the above apply.

Return ONLY the JSON via the tool call. Do not narrate.`;

const CROSS_DOC_SYSTEM_PROMPT = `You are a SENIOR CAPTURE MANAGER doing a CROSS-DOCUMENT contradiction review across an entire solicitation package.

You will receive each document's table of contents and key extracted snippets. Your ONLY job is to surface questions about REAL CONTRADICTIONS, INCONSISTENCIES, and CROSS-DOCUMENT GAPS between two or more documents. Do NOT repeat single-document questions.

HARD RULES — a question that violates ANY of these MUST NOT be emitted:

1. SELF-ANSWER CHECK. If your own cited quotes resolve the apparent conflict, drop the question.

2. NOT-A-CONFLICT FILTER. The following are NORMAL solicitation structure and are NOT contradictions:
   - A clause appearing in a representations checkbox list AND also as an active requirement elsewhere — that's the standard structure.
   - A clause incorporated by reference in Section I AND elaborated in Section H or L — that's expected.
   - A summary in one document and detail in another — not a conflict unless the substance disagrees.

3. CITATION ACCURACY. The cited regulations or deviations must actually govern the topic of the question. Do not cite an unrelated deviation as evidence.

4. TOPIC CAP — MAX 2 cross-doc questions per topic. Consolidate.

For every real contradiction, name BOTH sources (document + section) and quote the conflicting language verbatim. Use the "contradiction" category. Set topic_tag.

Question text MUST be at least 20 characters and a complete, well-formed question. Do not return fragments.

Return ONLY the JSON via the tool call.`;

const SYNTHESIS_SYSTEM_PROMPT = `You are a SENIOR CAPTURE MANAGER doing a final pre-submission review of a draft list of strategic questions. Your job is to remove duplicates, merge over-clustered topics, and cut weak questions BEFORE the list goes to the agency. Submitting too many overlapping questions tells the Government the team did not synthesize.

You will receive a JSON array of draft questions, each with: id, question_text, category, topic_tag, source_document, source_section, source_quote.

Apply these rules:

1. REMOVE any question whose source_quote already answers it.
2. REMOVE any question about standard FAR/DFARS boilerplate, representation checkboxes, or "reservation of rights" language.
3. REMOVE any question whose cited regulation/deviation does not actually govern the topic.
4. REMOVE exact duplicates and near-duplicates (>50% quote overlap or same normalized text).
5. CONSOLIDATE: when 3 or more questions share the same topic_tag (e.g. section_508, sca_wages, pii_privacy), merge them into AT MOST 2 sharper consolidated questions. Pick the strongest existing question as the keeper and rewrite its question_text + question_rationale to subsume the others. List the merged question IDs.
6. Do NOT remove genuinely distinct, sharp questions just to hit a number. Quality over volume.

Return ONLY the JSON via the tool call with two arrays:
- remove: [{ id, reason }]  — questions to delete entirely.
- merge: [{ keep_id, merge_ids: [...], new_question_text, new_question_rationale }] — keep_id stays (with rewritten text/rationale), merge_ids are deleted.

Every id you return must come from the input list. Do not invent ids.`;

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

const PER_BATCH_BUDGET = 50_000;
const PER_SECTION_HEAD = 2400;
const PER_SECTION_TAIL = 1200;
const SECTION_SPLIT_THRESHOLD = 8_000;
const SUB_CHUNK_SIZE = 6_000;
const SUB_CHUNK_OVERLAP = 500;

const CHUNKS_PER_CALL = 2;

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

function buildDocBlock(doc: Doc, sections: Section[], budget: number): { text: string } {
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
  return { text: parts.join("") };
}

function packBatches(docs: Doc[], sectionsByDoc: Map<string, Section[]>): Doc[][] {
  const cost = new Map<string, number>();
  for (const d of docs) {
    const ds = sectionsByDoc.get(d.id) ?? [];
    let c = 200;
    for (const s of ds) {
      const len = (s.content ?? "").length;
      c += Math.min(len, PER_SECTION_HEAD + PER_SECTION_TAIL + 40) + 100;
    }
    cost.set(d.id, c);
  }
  const sorted = [...docs].sort((a, b) => (cost.get(b.id) ?? 0) - (cost.get(a.id) ?? 0));
  const batches: Doc[][] = [];
  const totals: number[] = [];
  for (const d of sorted) {
    const c = cost.get(d.id) ?? 0;
    if (c > PER_BATCH_BUDGET * 0.7) {
      batches.push([d]);
      totals.push(c);
      continue;
    }
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

function sliceOversizedDoc(sections: Section[]): Section[][] {
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

function normalizeQuestionText(text: string): string {
  return text.toLowerCase().replace(/[^a-z0-9]+/g, " ").replace(/\s+/g, " ").trim();
}

function isUsableQuestion(text: string | undefined | null): boolean {
  if (!text) return false;
  const trimmed = text.trim();
  if (trimmed.length < 20) return false;
  if (!/[a-z]{4,}/i.test(trimmed)) return false;
  return true;
}

function mapRows(
  questions: Array<Record<string, unknown>>,
  solicitationId: string,
  docByName: Map<string, string>,
) {
  return questions
    .filter((q) => isUsableQuestion(q.question_text as string))
    .map((q) => {
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
        question_text: (q.question_text as string).trim(),
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
    const body = await req.json();
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    const logEvent = async (
      runIdForEvent: string | null | undefined,
      solicitationId: string,
      eventType: string,
      message: string | null,
      metadata: Record<string, unknown> = {},
    ) => {
      if (!runIdForEvent) return;
      try {
        await supabase.from("question_generation_run_events").insert({
          run_id: runIdForEvent,
          solicitation_id: solicitationId,
          event_type: eventType,
          message,
          metadata,
        });
      } catch (e) {
        console.warn("[generate-questions] logEvent failed (non-fatal)", e);
      }
    };

    if (body.continue && body.runId) {
      const out = await processNextChunks(supabase, body.runId as string, logEvent);
      return new Response(JSON.stringify(out), {
        status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (body.retryRunId) {
      const retryOut = await prepareRetry(supabase, body.retryRunId as string, logEvent);
      if ("error" in retryOut) {
        return new Response(JSON.stringify(retryOut), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const out = await processNextChunks(supabase, retryOut.runId, logEvent);
      return new Response(JSON.stringify({ ...out, parentRunId: retryOut.parentRunId }), {
        status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { solicitationId, focusAreas, focusDocumentIds } = body;
    if (!solicitationId) {
      return new Response(JSON.stringify({ error: "solicitationId required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const planResult = await planRun(supabase, solicitationId, focusDocumentIds, focusAreas, logEvent);
    if ("error" in planResult) {
      return new Response(JSON.stringify(planResult), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const out = await processNextChunks(supabase, planResult.runId, logEvent);
    return new Response(JSON.stringify(out), {
      status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("[generate-questions] error", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : String(e) }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

type Supa = ReturnType<typeof createClient>;
type LogFn = (
  runId: string | null | undefined,
  solicitationId: string,
  eventType: string,
  message: string | null,
  metadata?: Record<string, unknown>,
) => Promise<void>;

async function planRun(
  supabase: Supa,
  solicitationId: string,
  focusDocumentIds: string[] | undefined,
  focusAreas: string[] | undefined,
  logEvent: LogFn,
): Promise<{ runId: string } | { error: string }> {
  let docQuery = supabase
    .from("documents")
    .select("id, file_name")
    .eq("solicitation_id", solicitationId)
    .is("deleted_at", null)
    .in("status", ["parsed", "analyzed"]);
  if (focusDocumentIds?.length) docQuery = docQuery.in("id", focusDocumentIds);
  const { data: documents } = await docQuery;
  if (!documents || documents.length === 0) {
    return { error: "No processed documents available." };
  }
  const docIds = documents.map((d) => d.id);

  const { data: sections } = await supabase
    .from("document_sections")
    .select("document_id, section_number, section_title, content, page_start, sort_order")
    .in("document_id", docIds)
    .order("sort_order", { ascending: true });

  const rawSectionsByDoc = new Map<string, Section[]>();
  for (const d of documents) rawSectionsByDoc.set(d.id, []);
  for (const s of (sections ?? []) as Section[]) rawSectionsByDoc.get(s.document_id)?.push(s);
  const sectionsByDoc = new Map<string, Section[]>();
  for (const [docId, secs] of rawSectionsByDoc) sectionsByDoc.set(docId, expandSections(secs));

  type PlannedChunk = {
    kind: "doc_batch" | "cross_doc";
    label: string;
    doc_ids: string[];
    section_slice: { sort_orders?: number[] | null };
  };
  const planned: PlannedChunk[] = [];
  const baseBatches = packBatches(documents as Doc[], sectionsByDoc);
  for (const batch of baseBatches) {
    if (batch.length === 1) {
      const d = batch[0];
      const ds = sectionsByDoc.get(d.id) ?? [];
      const totalCost = ds.reduce(
        (sum, s) => sum + Math.min((s.content ?? "").length, PER_SECTION_HEAD + PER_SECTION_TAIL + 40) + 100,
        200,
      );
      if (totalCost > PER_BATCH_BUDGET) {
        const slices = sliceOversizedDoc(ds);
        slices.forEach((slice, idx) => {
          planned.push({
            kind: "doc_batch",
            label: `${d.file_name} (part ${idx + 1}/${slices.length})`,
            doc_ids: [d.id],
            section_slice: {
              sort_orders: slice.map((s) => s.sort_order ?? -1).filter((n) => n >= 0),
            },
          });
        });
        continue;
      }
    }
    planned.push({
      kind: "doc_batch",
      label: batch.map((d) => d.file_name).join(", "),
      doc_ids: batch.map((d) => d.id),
      section_slice: {},
    });
  }
  planned.push({
    kind: "cross_doc",
    label: "Cross-document contradiction pass",
    doc_ids: docIds,
    section_slice: {},
  });

  const { error: wipeErr } = await supabase
    .from("strategic_questions")
    .delete()
    .eq("solicitation_id", solicitationId)
    .eq("is_ai_generated", true);
  if (wipeErr) console.error("[generate-questions] pre-run wipe error", wipeErr);

  const { data: runRow, error: runErr } = await supabase
    .from("question_generation_runs")
    .insert({
      solicitation_id: solicitationId,
      status: "running",
      total_batches: planned.length,
      completed_batches: 0,
      failed_batches: 0,
      inserted_count: 0,
      current_step: `Planned ${planned.length} chunk(s)`,
    })
    .select("id")
    .single();
  if (runErr || !runRow) return { error: runErr?.message ?? "Failed to create run" };
  const runId = runRow.id as string;

  const chunkRows = planned.map((p, i) => ({
    run_id: runId,
    solicitation_id: solicitationId,
    chunk_index: i,
    kind: p.kind,
    label: p.label,
    doc_ids: p.doc_ids,
    section_slice: p.section_slice,
    status: "pending",
  }));
  const { error: chunkErr } = await supabase.from("question_generation_run_chunks").insert(chunkRows);
  if (chunkErr) {
    await supabase.from("question_generation_runs").update({
      status: "failed",
      error_message: `Failed to plan chunks: ${chunkErr.message}`,
      completed_at: new Date().toISOString(),
    }).eq("id", runId);
    return { error: chunkErr.message };
  }

  if (focusAreas?.length) {
    await logEvent(runId, solicitationId, "started",
      `Run started with focus areas: ${focusAreas.join(", ")}`,
      { focus_areas: focusAreas, total_chunks: planned.length });
  } else {
    await logEvent(runId, solicitationId, "started",
      `Run started (${planned.length} chunk(s))`,
      { total_chunks: planned.length });
  }

  return { runId };
}

async function prepareRetry(
  supabase: Supa,
  retryRunId: string,
  logEvent: LogFn,
): Promise<{ runId: string; parentRunId: string } | { error: string }> {
  const { data: prior } = await supabase
    .from("question_generation_runs")
    .select("id, solicitation_id, status")
    .eq("id", retryRunId)
    .maybeSingle();
  if (!prior) return { error: "Prior run not found" };

  await supabase
    .from("question_generation_runs")
    .update({
      status: "running",
      error_message: null,
      current_step: "Resuming…",
      completed_at: null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", retryRunId);

  const { data: chunks } = await supabase
    .from("question_generation_run_chunks")
    .select("id, status")
    .eq("run_id", retryRunId);
  const toReset = (chunks ?? []).filter((c) => c.status === "failed" || c.status === "running");
  if (toReset.length === 0) {
    return { error: "No failed chunks to retry on this run." };
  }
  await supabase
    .from("question_generation_run_chunks")
    .update({ status: "pending", error_message: null, started_at: null, completed_at: null })
    .in("id", toReset.map((c) => c.id));

  await logEvent(retryRunId, prior.solicitation_id as string, "retry_started",
    `Retrying ${toReset.length} chunk(s)`,
    { reset_count: toReset.length });

  return { runId: retryRunId, parentRunId: retryRunId };
}

async function processNextChunks(
  supabase: Supa,
  runId: string,
  logEvent: LogFn,
): Promise<{
  runId: string;
  status: string;
  done: boolean;
  processed: number;
  remaining: number;
  totalChunks: number;
  insertedThisCall: number;
  insertedTotal: number;
}> {
  const { data: run } = await supabase
    .from("question_generation_runs")
    .select("id, solicitation_id, status, inserted_count")
    .eq("id", runId)
    .maybeSingle();
  if (!run) throw new Error("Run not found");
  const solicitationId = run.solicitation_id as string;

  const { data: allChunks } = await supabase
    .from("question_generation_run_chunks")
    .select("id, chunk_index, kind, label, doc_ids, section_slice, status, attempts")
    .eq("run_id", runId)
    .order("chunk_index", { ascending: true });
  const chunks = allChunks ?? [];
  const totalChunks = chunks.length;

  const pending = chunks.filter((c) => c.status === "pending");
  if (pending.length === 0) {
    await finalizeRunStatus(supabase, runId, logEvent);
    const remainingDone = await loadRunSummary(supabase, runId);
    return {
      runId,
      status: remainingDone.status,
      done: true,
      processed: 0,
      remaining: 0,
      totalChunks,
      insertedThisCall: 0,
      insertedTotal: remainingDone.insertedTotal,
    };
  }

  const { data: sol } = await supabase
    .from("solicitations")
    .select("title, ai_summary, client_id, lens_overrides")
    .eq("id", solicitationId)
    .maybeSingle();
  const lens = await buildClientLens(sol?.client_id ?? null, {
    topic: "questions",
    query: `${(sol as any)?.title ?? ""} ${(sol as any)?.issuing_agency ?? ""} ${(((sol as any)?.ai_summary ?? "") + "").slice(0, 600)}`,
    override: (sol?.lens_overrides as Record<string, unknown> | null) ?? null,
  });
  const lensifiedSystem = lens.promptBlock ? `${lens.promptBlock}\n\n${SYSTEM_PROMPT}` : SYSTEM_PROMPT;
  const lensifiedCrossDoc = lens.promptBlock ? `${lens.promptBlock}\n\n${CROSS_DOC_SYSTEM_PROMPT}` : CROSS_DOC_SYSTEM_PROMPT;
  const summaryText = sol?.ai_summary ? `\n\nEXISTING ANALYSIS SUMMARY:\n${sol.ai_summary}` : "";

  const existingNorms = new Set<string>();
  const { data: existingRows } = await supabase
    .from("strategic_questions")
    .select("question_text")
    .eq("solicitation_id", solicitationId);
  for (const r of existingRows ?? []) existingNorms.add(normalizeQuestionText(r.question_text as string));

  const { data: allDocs } = await supabase
    .from("documents")
    .select("id, file_name")
    .eq("solicitation_id", solicitationId)
    .is("deleted_at", null);
  const docByName = new Map<string, string>();
  const docById = new Map<string, Doc>();
  for (const d of allDocs ?? []) {
    docByName.set(d.file_name, d.id);
    docById.set(d.id, d as Doc);
  }

  let insertedThisCall = 0;
  let processed = 0;

  const slice = pending.slice(0, CHUNKS_PER_CALL);
  for (const chunk of slice) {
    await supabase
      .from("question_generation_run_chunks")
      .update({
        status: "running",
        attempts: (chunk.attempts ?? 0) + 1,
        started_at: new Date().toISOString(),
        error_message: null,
      })
      .eq("id", chunk.id);

    await supabase
      .from("question_generation_runs")
      .update({
        current_step: `Chunk ${chunk.chunk_index + 1}/${totalChunks}: ${chunk.label}`,
        updated_at: new Date().toISOString(),
      })
      .eq("id", runId);
    await logEvent(runId, solicitationId, "batch_started",
      `Chunk ${chunk.chunk_index + 1}/${totalChunks}: ${chunk.label}`,
      { index: chunk.chunk_index + 1, total: totalChunks, kind: chunk.kind });

    try {
      const inserted = await runChunk(supabase, {
        chunk,
        sol,
        solicitationId,
        docByName,
        docById,
        lensifiedSystem,
        lensifiedCrossDoc,
        summaryText,
        existingNorms,
      });
      insertedThisCall += inserted;
      await supabase
        .from("question_generation_run_chunks")
        .update({
          status: "completed",
          inserted_count: inserted,
          completed_at: new Date().toISOString(),
        })
        .eq("id", chunk.id);
      await logEvent(runId, solicitationId, "batch_completed",
        `Chunk ${chunk.chunk_index + 1}/${totalChunks} added ${inserted} question(s)`,
        { index: chunk.chunk_index + 1, total: totalChunks, inserted });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error(`[generate-questions] chunk ${chunk.chunk_index} failed`, err);
      await supabase
        .from("question_generation_run_chunks")
        .update({
          status: "failed",
          error_message: msg,
          completed_at: new Date().toISOString(),
        })
        .eq("id", chunk.id);
      await logEvent(runId, solicitationId, "batch_failed",
        `Chunk ${chunk.chunk_index + 1}/${totalChunks} failed: ${msg}`,
        { index: chunk.chunk_index + 1, total: totalChunks });
    }
    processed++;
    await refreshRunAggregates(supabase, runId);
  }

  const { data: remainingChunks } = await supabase
    .from("question_generation_run_chunks")
    .select("id")
    .eq("run_id", runId)
    .eq("status", "pending");
  const remaining = (remainingChunks ?? []).length;

  if (remaining === 0) {
    await finalizeRunStatus(supabase, runId, logEvent);
  }

  const summary = await loadRunSummary(supabase, runId);
  return {
    runId,
    status: summary.status,
    done: remaining === 0,
    processed,
    remaining,
    totalChunks,
    insertedThisCall,
    insertedTotal: summary.insertedTotal,
  };
}

async function loadRunSummary(supabase: Supa, runId: string) {
  const { data } = await supabase
    .from("question_generation_runs")
    .select("status, inserted_count")
    .eq("id", runId)
    .maybeSingle();
  return {
    status: (data?.status as string) ?? "unknown",
    insertedTotal: (data?.inserted_count as number) ?? 0,
  };
}

async function refreshRunAggregates(supabase: Supa, runId: string) {
  const { data: chunks } = await supabase
    .from("question_generation_run_chunks")
    .select("status, inserted_count")
    .eq("run_id", runId);
  const list = chunks ?? [];
  const completed = list.filter((c) => c.status === "completed").length;
  const failed = list.filter((c) => c.status === "failed").length;
  const inserted = list.reduce((s, c) => s + ((c.inserted_count as number) ?? 0), 0);
  await supabase
    .from("question_generation_runs")
    .update({
      completed_batches: completed,
      failed_batches: failed,
      inserted_count: inserted,
      updated_at: new Date().toISOString(),
    })
    .eq("id", runId);
}

async function finalizeRunStatus(supabase: Supa, runId: string, logEvent: LogFn) {
  const { data: chunks } = await supabase
    .from("question_generation_run_chunks")
    .select("status, kind, doc_ids, inserted_count")
    .eq("run_id", runId);
  const list = chunks ?? [];
  if (list.some((c) => c.status === "pending" || c.status === "running")) return;

  const completed = list.filter((c) => c.status === "completed").length;
  const failed = list.filter((c) => c.status === "failed");
  const inserted = list.reduce((s, c) => s + ((c.inserted_count as number) ?? 0), 0);
  const failedDocIds = new Set<string>();
  let crossDocFailed = false;
  for (const f of failed) {
    if (f.kind === "cross_doc") crossDocFailed = true;
    for (const id of (f.doc_ids as string[]) ?? []) failedDocIds.add(id);
  }
  const status =
    failed.length === 0 ? "completed" : completed > 0 ? "partial" : "failed";

  const { data: run } = await supabase
    .from("question_generation_runs")
    .select("solicitation_id")
    .eq("id", runId)
    .maybeSingle();

  await supabase
    .from("question_generation_runs")
    .update({
      status,
      completed_batches: completed,
      failed_batches: failed.length,
      inserted_count: inserted,
      failed_doc_ids: Array.from(failedDocIds),
      cross_doc_failed: crossDocFailed,
      current_step: null,
      completed_at: new Date().toISOString(),
      error_message: failed.length > 0 ? `${failed.length} chunk(s) failed` : null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", runId);

  if (run) {
    await logEvent(runId, run.solicitation_id as string, status,
      `Run ${status} · inserted=${inserted} ok=${completed} failed=${failed.length}`,
      { inserted, completed, failed: failed.length });
  }
}

async function runChunk(
  supabase: Supa,
  ctx: {
    chunk: any;
    sol: any;
    solicitationId: string;
    docByName: Map<string, string>;
    docById: Map<string, Doc>;
    lensifiedSystem: string;
    lensifiedCrossDoc: string;
    summaryText: string;
    existingNorms: Set<string>;
  },
): Promise<number> {
  const { chunk, sol, solicitationId, docByName, docById, lensifiedSystem, lensifiedCrossDoc, summaryText, existingNorms } = ctx;
  const docIds = (chunk.doc_ids as string[]) ?? [];
  if (docIds.length === 0) return 0;

  if (chunk.kind === "doc_batch") {
    const docs = docIds.map((id) => docById.get(id)).filter(Boolean) as Doc[];
    if (docs.length === 0) throw new Error("Chunk references missing documents");

    const { data: rawSections } = await supabase
      .from("document_sections")
      .select("document_id, section_number, section_title, content, page_start, sort_order")
      .in("document_id", docIds)
      .order("sort_order", { ascending: true });
    const rawByDoc = new Map<string, Section[]>();
    for (const d of docs) rawByDoc.set(d.id, []);
    for (const s of (rawSections ?? []) as Section[]) rawByDoc.get(s.document_id)?.push(s);
    const expandedByDoc = new Map<string, Section[]>();
    for (const [id, secs] of rawByDoc) expandedByDoc.set(id, expandSections(secs));

    const sliceOrders: number[] | null =
      chunk.section_slice && Array.isArray(chunk.section_slice.sort_orders)
        ? chunk.section_slice.sort_orders as number[]
        : null;
    const unitSections = new Map<string, Section[]>();
    for (const [id, secs] of expandedByDoc) {
      if (sliceOrders) {
        const orderSet = new Set(sliceOrders);
        unitSections.set(id, secs.filter((s) => orderSet.has(s.sort_order ?? -1)));
      } else {
        unitSections.set(id, secs);
      }
    }

    const perDocBudget = Math.floor(PER_BATCH_BUDGET / docs.length);
    let docBlocks = "";
    for (const d of docs) {
      const ds = unitSections.get(d.id) ?? [];
      const { text } = buildDocBlock(d, ds, perDocBudget);
      docBlocks += text;
    }
    const userPrompt = `Solicitation: ${sol?.title ?? "Untitled"}${summaryText}\n\nDocuments in this batch: ${docs.map((d) => d.file_name).join(", ")}.\n${docBlocks}\n\nGenerate the FULL exhaustive list of strategic questions for THESE documents now.`;

    const parsed = (await callAiTool({
      functionName: "generate-questions",
      system: lensifiedSystem,
      user: userPrompt,
      tool: SCHEMA,
    })) as Record<string, any>;
    const questions = (parsed?.questions ?? []) as Array<Record<string, unknown>>;
    return await insertDeduped(supabase, solicitationId, questions, docByName, existingNorms);
  }

  const PER_DOC_ENTITY_CAP = 40;
  const TOC_CAP = 25;
  const SNIPPET_CAP = 60;
  const HARD_PROMPT_CAP = 100_000;

  const docs = docIds.map((id) => docById.get(id)).filter(Boolean) as Doc[];
  const { data: rawSections } = await supabase
    .from("document_sections")
    .select("document_id, section_number, section_title, page_start")
    .in("document_id", docIds)
    .order("sort_order", { ascending: true });
  const rawByDoc = new Map<string, any[]>();
  for (const d of docs) rawByDoc.set(d.id, []);
  for (const s of rawSections ?? []) rawByDoc.get(s.document_id as string)?.push(s);

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

  let prompt = `Solicitation: ${sol?.title ?? "Untitled"}${summaryText}\n\nDocuments in package:\n`;
  for (const d of docs) {
    const ds = rawByDoc.get(d.id) ?? [];
    const toc = ds
      .map((s) => `  ${s.section_number ?? "?"}  ${s.section_title ?? ""} (p.${s.page_start ?? "?"})`)
      .slice(0, TOC_CAP)
      .join("\n");
    prompt += `\n--- ${d.file_name} ---\n${toc}\n`;
  }
  let entityCount = 0;
  let entitiesBlock = "";
  for (const d of docs) {
    const list = entitiesByDoc.get(d.id) ?? [];
    for (const e of list) {
      const snip = e.context_snippet ? ` — ${String(e.context_snippet).slice(0, SNIPPET_CAP)}` : "";
      entitiesBlock += `[${d.file_name} p.${e.page_number ?? "?"}] ${e.entity_type}: ${e.entity_value}${snip}\n`;
      entityCount++;
    }
  }
  if (entityCount > 0) {
    prompt += `\n\n--- KEY EXTRACTED FACTS ACROSS DOCUMENTS (${entityCount} facts) ---\n${entitiesBlock}`;
  }
  prompt += `\n\nFind every contradiction, inconsistency, or cross-document gap. Skip questions about a single document in isolation.`;
  if (prompt.length > HARD_PROMPT_CAP) prompt = prompt.slice(0, HARD_PROMPT_CAP) + "\n…[truncated]…";

  const parsed = (await callAiTool({
    functionName: "generate-questions",
    system: lensifiedCrossDoc,
    user: prompt,
    tool: SCHEMA,
    modelOverride: { provider: "lovable", model: "google/gemini-2.5-pro", maxTokens: 32000 },
  })) as Record<string, any>;
  const questions = (parsed?.questions ?? []) as Array<Record<string, unknown>>;
  return await insertDeduped(supabase, solicitationId, questions, docByName, existingNorms);
}

async function insertDeduped(
  supabase: Supa,
  solicitationId: string,
  questions: Array<Record<string, unknown>>,
  docByName: Map<string, string>,
  existingNorms: Set<string>,
): Promise<number> {
  const candidates = mapRows(questions, solicitationId, docByName);
  const fresh: typeof candidates = [];
  for (const row of candidates) {
    const norm = normalizeQuestionText(row.question_text);
    if (!norm) continue;
    if (existingNorms.has(norm)) continue;
    existingNorms.add(norm);
    fresh.push(row);
  }
  if (fresh.length === 0) return 0;
  const { error } = await supabase.from("strategic_questions").insert(fresh);
  if (error) throw new Error(`insert failed: ${error.message}`);
  return fresh.length;
}
