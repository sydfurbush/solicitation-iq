// Runs an EXISTING client knowledge file through onboarding triage, so files
// that went into the knowledge base before triage existed get checked for
// pricing, personal data, signatures, agreement terms and partner content.
//
// Staff only (owner/admin/analyst of the client's organization). The file is
// copied into the client-onboarding bucket and linked back to the knowledge
// document through client_onboarding_documents.knowledge_document_id. Running
// it again re-triages the same copy instead of making a new one.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { aiErrorResponse } from "../_shared/aiClient.ts";
import { requireUser, authErrorResponse } from "../_shared/callerAuth.ts";
import { UnsupportedFileError } from "../_shared/extractText.ts";
import { sanitizeFileName } from "../_shared/onboardingTriage.ts";
import { ONBOARDING_BUCKET, markStatus, runOnboardingTriage } from "../_shared/triageRunner.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};
const KNOWLEDGE_BUCKET = "client-knowledge";
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  let onboardingId = "";
  const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, {
    auth: { persistSession: false },
  });

  try {
    const { user, userClient } = await requireUser(req);
    const body = await req.json().catch(() => ({}));
    const knowledgeId = typeof body?.knowledgeDocumentId === "string" ? body.knowledgeDocumentId : "";
    if (!UUID_RE.test(knowledgeId)) return json({ error: "knowledgeDocumentId required" }, 400);

    // Can the caller see this knowledge document? (row-level security decides)
    const { data: kdoc } = await userClient
      .from("client_knowledge_documents")
      .select("id, client_id, title, file_path, mime_type, source_type")
      .eq("id", knowledgeId)
      .maybeSingle();
    if (!kdoc) return json({ error: "Document not found" }, 404);
    if (kdoc.source_type !== "upload" || !kdoc.file_path) {
      return json({ error: "Only uploaded files can be re-checked. Typed notes are written by staff." }, 422);
    }

    // Only staff who can edit onboarding for this client.
    const { data: canEdit } = await userClient.rpc("can_edit_onboarding", { _client_id: kdoc.client_id });
    if (canEdit !== true) return json({ error: "Not allowed" }, 403);

    // Reuse the earlier copy if this file was re-checked before.
    const { data: existing } = await admin
      .from("client_onboarding_documents")
      .select("id, client_id, file_name, file_path, mime_type, status")
      .eq("knowledge_document_id", kdoc.id)
      .maybeSingle();

    let doc = existing;
    if (doc?.status === "processing") return json({ documentId: doc.id, status: "processing" }, 409);

    if (!doc) {
      const fileName = kdoc.file_path.split("/").pop() || kdoc.title || "file";
      const { data: blob, error: dlErr } = await admin.storage.from(KNOWLEDGE_BUCKET).download(kdoc.file_path);
      if (dlErr || !blob) throw new Error(`download failed: ${dlErr?.message ?? "no data"}`);

      const id = crypto.randomUUID();
      const path = `${kdoc.client_id}/${id}-${sanitizeFileName(fileName)}`;
      const { error: upErr } = await admin.storage.from(ONBOARDING_BUCKET)
        .upload(path, blob, { contentType: kdoc.mime_type ?? undefined, upsert: false });
      if (upErr) throw upErr;

      const { data: inserted, error: insErr } = await admin.from("client_onboarding_documents").insert({
        id,
        client_id: kdoc.client_id,
        file_name: kdoc.title || fileName,
        file_path: path,
        mime_type: kdoc.mime_type,
        uploaded_by: user.id,
        uploaded_by_kind: "staff",
        received_via: "other",
        received_from: "Existing knowledge base",
        knowledge_document_id: kdoc.id,
      }).select("id, client_id, file_name, file_path, mime_type, status").single();
      if (insErr) {
        await admin.storage.from(ONBOARDING_BUCKET).remove([path]);
        throw insErr;
      }
      doc = inserted;
    }

    onboardingId = doc.id;
    await runOnboardingTriage(admin, doc);
    return json({ documentId: doc.id, status: "triaged" });
  } catch (err) {
    const authResp = authErrorResponse(err, corsHeaders);
    if (authResp) return authResp;
    const friendly = err instanceof UnsupportedFileError;
    if (onboardingId) {
      await markStatus(admin, onboardingId, "failed", friendly ? (err as Error).message : "Processing failed. Please try again.");
    }
    if (friendly) return json({ documentId: onboardingId || null, status: "failed", error: (err as Error).message }, 422);
    console.error("[recheck-knowledge-document]", err);
    return aiErrorResponse(err, corsHeaders);
  }
});
