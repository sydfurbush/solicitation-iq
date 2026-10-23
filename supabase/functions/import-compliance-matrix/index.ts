// Imports a compliance matrix spreadsheet (xlsx/xls/csv) into a solicitation.
//
// Each spreadsheet row becomes a master requirement (origin "import"); existing
// AI-extracted items whose section or clause the row covers are linked under it
// with covered_by_id. Nothing existing is deleted or rewritten. Re-importing the
// same sheet refreshes rows by their ID instead of duplicating them.
//
// POST { solicitationId, fileName, fileBase64, apply?: boolean }
//   apply=false (default): returns a preview of what would happen.
//   apply=true: writes it.
// Staff with access to the solicitation only.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import * as XLSX from "npm:xlsx@0.18.5";
import { requireUser, authErrorResponse } from "../_shared/callerAuth.ts";
import {
  docKindFromFileName,
  parseMatrixSheet,
  planImport,
  type ExistingItem,
  type ImportRow,
  type ParseResult,
} from "../_shared/complianceMatrix.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const MAX_BYTES = 5 * 1024 * 1024;

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
}

/** Pick the sheet that looks like the matrix: by name first, then the first sheet that parses. */
function readWorkbook(bytes: Uint8Array): { sheet: string; parsed: ParseResult } | { error: string } {
  const wb = XLSX.read(bytes, { type: "array" });
  const names = [...wb.SheetNames].sort((a, b) => Number(/compliance|matrix|rtm/i.test(b)) - Number(/compliance|matrix|rtm/i.test(a)));
  for (const name of names) {
    const rows = XLSX.utils.sheet_to_json(wb.Sheets[name], { header: 1, raw: false, defval: null }) as unknown[][];
    const parsed = parseMatrixSheet(rows);
    if (parsed.rows.length) return { sheet: name, parsed };
  }
  return { error: "No sheet with an ID column and a Requirement column was found." };
}

const toFields = (r: ImportRow, fileName: string) => ({
  req_number: r.external_id,
  external_id: r.external_id,
  shall_text: r.text,
  source_section: r.reference || null,
  source_citation: r.reference || null,
  area: r.area || null,
  requirement_type: r.requirement_type || null,
  proposal_section: r.proposal_location || null,
  response_evidence: r.response_evidence || null,
  workflow_status: r.workflow_status,
  action_needed: r.action_needed || null,
  needs_clarification: r.needs_clarification,
  criticality: r.criticality,
  compliance_owner: r.owner || null,
  applicability: r.applicability,
  import_source: fileName.slice(0, 200),
  origin: "import",
  is_ai_generated: false,
});

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);
  try {
    const { user, userClient } = await requireUser(req);
    const body = await req.json().catch(() => ({}));
    const solicitationId = typeof body?.solicitationId === "string" ? body.solicitationId : "";
    const fileName = typeof body?.fileName === "string" ? body.fileName : "matrix.xlsx";
    const apply = body?.apply === true;
    if (!UUID_RE.test(solicitationId)) return json({ error: "solicitationId required" }, 400);
    if (typeof body?.fileBase64 !== "string" || !body.fileBase64) return json({ error: "fileBase64 required" }, 400);
    if (!/\.(xlsx|xlsm|xls|csv)$/i.test(fileName)) return json({ error: "Upload an Excel (.xlsx, .xls) or CSV file." }, 422);

    const { data: sol } = await userClient.from("solicitations").select("id").eq("id", solicitationId).maybeSingle();
    if (!sol) return json({ error: "Solicitation not found" }, 404);
    const [{ data: staff }, { data: member }] = await Promise.all([
      userClient.rpc("is_org_staff", { _user_id: user.id }),
      userClient.rpc("is_solicitation_member", { _user_id: user.id, _sol_id: solicitationId }),
    ]);
    if (staff !== true || member !== true) return json({ error: "Not allowed" }, 403);

    const bytes = Uint8Array.from(atob(body.fileBase64), (c) => c.charCodeAt(0));
    if (bytes.byteLength > MAX_BYTES) return json({ error: "File is larger than 5 MB." }, 413);
    const book = readWorkbook(bytes);
    if ("error" in book) return json({ error: book.error }, 422);

    const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const [{ data: docs }, { data: items }] = await Promise.all([
      admin.from("documents").select("id, file_name").eq("solicitation_id", solicitationId),
      admin.from("requirement_items").select("id, req_number, shall_text, source_section, source_document_id, origin, external_id, covered_by_id").eq("solicitation_id", solicitationId),
    ]);
    const kind = new Map((docs ?? []).map((d: { id: string; file_name: string }) => [d.id, docKindFromFileName(d.file_name)] as const));
    const existing: ExistingItem[] = (items ?? []).map((r: Record<string, any>) => ({
      id: r.id, req_number: r.req_number, shall_text: r.shall_text, source_section: r.source_section,
      doc_kind: r.source_document_id ? kind.get(r.source_document_id) ?? null : null,
      origin: r.origin ?? "ai", external_id: r.external_id, covered_by_id: r.covered_by_id,
    }));
    const plan = planImport(book.parsed.rows, existing);

    const summary = {
      sheet: book.sheet,
      rows: book.parsed.rows.length,
      skipped: book.parsed.skipped,
      columnsFound: Object.keys(book.parsed.columns),
      newRequirements: plan.inserts.length,
      refreshedRequirements: plan.updates.length,
      groupedExistingItems: plan.cover.length,
      standaloneExistingItems: plan.uncovered.length,
      byStatus: book.parsed.rows.reduce<Record<string, number>>((a, r) => ({ ...a, [r.workflow_status]: (a[r.workflow_status] ?? 0) + 1 }), {}),
      needingClarification: book.parsed.rows.filter((r) => r.needs_clarification).length,
    };
    if (!apply) return json({ preview: true, ...summary });

    // 1. Insert new master rows and refresh existing ones.
    const idByExternal = new Map(existing.filter((e) => e.external_id).map((e) => [e.external_id!, e.id]));
    for (let i = 0; i < plan.inserts.length; i += 200) {
      const { data, error } = await admin.from("requirement_items")
        .insert(plan.inserts.slice(i, i + 200).map((r) => ({ solicitation_id: solicitationId, created_by: user.id, ...toFields(r, fileName) })))
        .select("id, external_id");
      if (error) throw error;
      for (const d of (data ?? []) as Array<{ id: string; external_id: string }>) idByExternal.set(d.external_id, d.id);
    }
    for (const u of plan.updates) {
      const { error } = await admin.from("requirement_items").update({ ...toFields(u.row, fileName), updated_at: new Date().toISOString() }).eq("id", u.id);
      if (error) throw error;
    }

    // 2. Group existing detailed items under their master row.
    const groups = new Map<string, string[]>();
    for (const c of plan.cover) groups.set(c.externalId, [...(groups.get(c.externalId) ?? []), c.itemId]);
    for (const [ext, ids] of groups) {
      const masterId = idByExternal.get(ext);
      if (!masterId) continue;
      const { error } = await admin.from("requirement_items").update({ covered_by_id: masterId }).in("id", ids);
      if (error) throw error;
    }

    // 3. Give each master the outline section its grouped items already sit in,
    //    so the matrix shows where it is answered (only when unambiguous).
    const { data: outline } = await admin.from("proposal_outlines").select("id").eq("solicitation_id", solicitationId)
      .eq("is_active", true).order("version", { ascending: false }).limit(1).maybeSingle();
    let linked = 0;
    if (outline) {
      const { data: nodes } = await admin.from("outline_nodes").select("id, linked_requirement_ids").eq("outline_id", outline.id);
      const nodeOf = new Map<string, string>();
      for (const n of (nodes ?? []) as Array<{ id: string; linked_requirement_ids: string[] | null }>) for (const rid of n.linked_requirement_ids ?? []) nodeOf.set(rid, n.id);
      const additions = new Map<string, string[]>();
      for (const [ext, ids] of groups) {
        const masterId = idByExternal.get(ext);
        if (!masterId || nodeOf.has(masterId)) continue;
        const targets = [...new Set(ids.map((i) => nodeOf.get(i)).filter(Boolean))] as string[];
        if (targets.length === 1) additions.set(targets[0], [...(additions.get(targets[0]) ?? []), masterId]);
      }
      for (const [nodeId, add] of additions) {
        const node = (nodes ?? []).find((n: { id: string }) => n.id === nodeId)!;
        const { error } = await admin.from("outline_nodes")
          .update({ linked_requirement_ids: [...new Set([...(node.linked_requirement_ids ?? []), ...add])] }).eq("id", nodeId);
        if (error) throw error;
        linked += add.length;
      }
    }

    return json({ applied: true, ...summary, mastersLinkedToOutline: linked });
  } catch (e) {
    const authResp = authErrorResponse(e, corsHeaders);
    if (authResp) return authResp;
    console.error("[import-compliance-matrix]", e);
    return json({ error: "Import failed. Please check the file and try again." }, 500);
  }
});
