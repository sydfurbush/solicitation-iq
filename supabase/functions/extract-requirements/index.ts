// Extracts every binding requirement from a solicitation's parsed documents
// and MERGES them into the requirements already on file.
//
// What changed (Oct 2026): the old version read at most 60 sections per
// document, 600 characters each, capped at 45,000 characters, so long PWSs lost
// their task sections (e.g. all of PWS Part 5). It also either duplicated every
// requirement or deleted them all on re-run. Now:
// - every requirement-bearing section is read, in batches, in the background;
// - results are merged: duplicates are skipped and nothing is deleted or
//   rewritten, so outline links and [Req-X] citations survive;
// - new items under an imported master row are linked to it (covered_by_id);
// - post-award contract terms are tagged applicability = post_award.
// Progress is recorded in requirement_extraction_runs.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { callAiTool, aiErrorResponse } from "../_shared/aiClient.ts";
import { buildClientLens } from "../_shared/clientLens.ts";
import { requireUser, authErrorResponse } from "../_shared/callerAuth.ts";
import {
  batchSections,
  classifyApplicability,
  docKindFromFileName,
  mergeExtracted,
  type ExistingItem,
  type ExtractedItem,
  type ImportRow,
  type SourceSection,
} from "../_shared/complianceMatrix.ts";

declare const EdgeRuntime: { waitUntil(p: Promise<unknown>): void } | undefined;

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const CONCURRENCY = 4;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const SYSTEM_PROMPT = `You build a Requirements Traceability Matrix (RTM) for a federal proposal.

For every binding obligation in the source documents — verbs like "shall", "must", "will", or "is required to" — emit ONE row. Be exhaustive. Do not summarize, do not deduplicate, do not skip "minor" requirements. A typical RFP has 80-300 shall statements.

For each row return:
- req_number: hierarchical number you assign in source order, e.g. "C-3.2.1.4" preferred when the source numbering exists, else sequential "R-001", "R-002"...
- shall_text: the verbatim binding sentence (≤500 chars, trim only)
- source_section: the source section code, prefer the Section letter+number (e.g. "C.3.2", "L.5", "M.4(a)")
- source_document: filename of the document the statement came from
- source_page: page number if known
- source_quote: short quoted snippet (≤280 chars) including the binding verb

Return ONLY structured output via the tool call.`;

const SCHEMA = {
  name: "extract_requirements",
  description: "List of every binding requirement (shall/must/will) in the solicitation.",
  parameters: {
    type: "object",
    properties: {
      requirements: {
        type: "array",
        items: {
          type: "object",
          properties: {
            req_number: { type: "string" },
            shall_text: { type: "string" },
            source_section: { type: "string" },
            source_document: { type: "string" },
            source_page: { type: "number" },
            source_quote: { type: "string" },
          },
          required: ["req_number", "shall_text"],
        },
      },
    },
    required: ["requirements"],
  },
};


function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
}

type Admin = ReturnType<typeof createClient>;

async function runExtraction(admin: Admin, solicitationId: string, runId: string, batches: string[][], docs: Array<{ id: string; file_name: string }>, systemPrompt: string, title: string) {
  const extracted: Array<Record<string, unknown>> = [];
  let done = 0, failed = 0, next = 0;
  const update = (patch: Record<string, unknown>) =>
    admin.from("requirement_extraction_runs").update({ ...patch, updated_at: new Date().toISOString() }).eq("id", runId);

  const worker = async () => {
    while (next < batches.length) {
      const i = next++;
      try {
        const parsed = await callAiTool({
          functionName: "extract-requirements",
          system: systemPrompt,
          user: `Solicitation: ${title}\nBatch ${i + 1} of ${batches.length}. Number requirements from their source section.\n\n${batches[i].join("\n\n")}\n\nExtract every binding requirement in this batch.`,
          tool: SCHEMA,
        }) as { requirements?: Array<Record<string, unknown>> };
        extracted.push(...(parsed.requirements ?? []));
        done++;
      } catch (e) {
        console.error(`[extract-requirements] batch ${i + 1} failed`, e);
        failed++;
      }
      await update({ completed_batches: done, failed_batches: failed, current_step: `Read ${done + failed} of ${batches.length} batches` });
    }
  };

  try {
    await Promise.all(Array.from({ length: Math.min(CONCURRENCY, batches.length) }, worker));

    // Merge against what is on file now (it may have changed while we worked).
    const kindByDoc = new Map(docs.map((d) => [d.id, docKindFromFileName(d.file_name)]));
    const docByName = new Map(docs.map((d) => [d.file_name, d.id]));
    const { data: rows } = await admin
      .from("requirement_items")
      .select("id, req_number, shall_text, source_section, source_document_id, origin, external_id, covered_by_id")
      .eq("solicitation_id", solicitationId);
    const existing: ExistingItem[] = (rows ?? []).map((r: Record<string, any>) => ({
      id: r.id, req_number: r.req_number, shall_text: r.shall_text, source_section: r.source_section,
      doc_kind: r.source_document_id ? kindByDoc.get(r.source_document_id) ?? null : null,
      origin: r.origin ?? "ai", external_id: r.external_id, covered_by_id: r.covered_by_id,
    }));
    const masters = existing.filter((e) => e.origin === "import" && e.external_id)
      .map((e) => ({ external_id: e.external_id!, reference: e.source_section ?? "", text: e.shall_text ?? "" }) as ImportRow);
    const masterId = new Map(existing.filter((e) => e.external_id).map((e) => [e.external_id!, e.id]));

    const incoming = extracted
      .filter((r) => typeof r.shall_text === "string" && (r.shall_text as string).trim())
      .map((r, i) => {
        const docId = r.source_document ? docByName.get(r.source_document as string) ?? null : null;
        return {
          req_number: (r.req_number as string) || `R-${String(i + 1).padStart(3, "0")}`,
          shall_text: String(r.shall_text).slice(0, 2000),
          source_section: (r.source_section as string) ?? null,
          doc_kind: docId ? kindByDoc.get(docId) ?? null : null,
          raw: r, docId,
        } as ExtractedItem & { raw: Record<string, unknown>; docId: string | null };
      });
    const { inserts, duplicates } = mergeExtracted(existing, masters, incoming);

    const toRow = (r: typeof inserts[number]) => {
      const page = r.raw.source_page != null ? parseInt(String(r.raw.source_page), 10) : NaN;
      return {
        solicitation_id: solicitationId,
        req_number: r.req_number,
        shall_text: r.shall_text,
        source_section: r.source_section,
        source_document_id: r.docId,
        page_number: Number.isFinite(page) ? page : null,
        source_quote: (r.raw.source_quote as string) ?? null,
        source_citation: r.source_section ? `${r.source_section}${Number.isFinite(page) ? `, p.${page}` : ""}` : null,
        is_ai_generated: true,
        origin: "ai",
        applicability: classifyApplicability(r.shall_text, r.source_section),
        covered_by_id: r.cover_external_id ? masterId.get(r.cover_external_id) ?? null : null,
      };
    };
    for (let i = 0; i < inserts.length; i += 200) {
      const { error } = await admin.from("requirement_items").insert(inserts.slice(i, i + 200).map(toRow));
      if (error) throw error;
    }
    await update({
      status: failed && !done ? "failed" : "completed",
      inserted_count: inserts.length,
      duplicate_count: duplicates.length,
      current_step: failed ? `Done; ${failed} batch(es) failed and can be re-run` : "Done",
      completed_at: new Date().toISOString(),
    });
  } catch (e) {
    console.error("[extract-requirements] run failed", e);
    await update({ status: "failed", error_message: String((e as Error)?.message ?? e).slice(0, 1000), completed_at: new Date().toISOString() });
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const { user, userClient } = await requireUser(req);
    const body = await req.json().catch(() => ({}));
    const solicitationId = typeof body?.solicitationId === "string" ? body.solicitationId : "";
    if (!UUID_RE.test(solicitationId)) return json({ error: "solicitationId required" }, 400);
    // `regenerate` is accepted for compatibility but no longer deletes anything: every run merges.

    const { data: sol } = await userClient.from("solicitations").select("id, title, client_id").eq("id", solicitationId).maybeSingle();
    if (!sol) return json({ error: "Solicitation not found" }, 404);
    const [{ data: staff }, { data: member }] = await Promise.all([
      userClient.rpc("is_org_staff", { _user_id: user.id }),
      userClient.rpc("is_solicitation_member", { _user_id: user.id, _sol_id: solicitationId }),
    ]);
    if (staff !== true || member !== true) return json({ error: "Not allowed" }, 403);

    const admin = createClient(SUPABASE_URL, SERVICE_KEY);
    const { data: running } = await admin.from("requirement_extraction_runs").select("id, updated_at")
      .eq("solicitation_id", solicitationId).eq("status", "running").order("started_at", { ascending: false }).limit(1).maybeSingle();
    if (running && Date.now() - new Date(running.updated_at).getTime() < 10 * 60 * 1000) {
      return json({ runId: running.id, status: "running" }, 409);
    }

    const { data: documents } = await admin.from("documents").select("id, file_name")
      .eq("solicitation_id", solicitationId).is("deleted_at", null).in("status", ["parsed", "analyzed"]);
    if (!documents?.length) return json({ error: "No processed documents available." }, 400);

    const nameById = new Map(documents.map((d: { id: string; file_name: string }) => [d.id, d.file_name] as const));
    const { data: sections } = await admin.from("document_sections")
      .select("document_id, section_number, section_title, content, page_start, sort_order")
      .in("document_id", documents.map((d: { id: string }) => d.id))
      .order("document_id").order("sort_order", { ascending: true });
    const batches = batchSections((sections ?? []).map((s: Record<string, any>) => ({ ...s, file_name: nameById.get(s.document_id) ?? "" })) as SourceSection[]);
    if (!batches.length) return json({ error: "No requirement-bearing sections found." }, 400);

    const lens = await buildClientLens(sol.client_id ?? null, { topic: "requirements", query: sol.title ?? "" });
    const systemPrompt = lens.promptBlock ? `${lens.promptBlock}\n\n${SYSTEM_PROMPT}` : SYSTEM_PROMPT;

    const { data: run, error: runErr } = await admin.from("requirement_extraction_runs").insert({
      solicitation_id: solicitationId, status: "running", total_batches: batches.length, created_by: user.id,
      current_step: `Reading ${batches.length} batches`,
    }).select("id").single();
    if (runErr) throw runErr;

    const work = runExtraction(admin, solicitationId, run.id, batches, documents, systemPrompt, sol.title ?? "Untitled");
    if (typeof EdgeRuntime !== "undefined") EdgeRuntime.waitUntil(work); else await work;
    return json({ runId: run.id, status: "running", totalBatches: batches.length }, 202);
  } catch (e) {
    const authResp = authErrorResponse(e, corsHeaders);
    if (authResp) return authResp;
    console.error("[extract-requirements] error", e);
    return aiErrorResponse(e, corsHeaders);
  }
});
