// Triages one document a client (or staff on their behalf) uploaded during
// onboarding: extracts its text, asks the AI to classify it, applies the
// deterministic rules in _shared/onboardingTriage.ts, and stores the result.
//
// Access: the caller must be signed in and able to see the document under
// row-level security (staff of the owning organization, or a portal user of
// that client). The triage result is written to client_onboarding_triage,
// which only staff can read; the caller gets back only the status.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { aiErrorResponse } from "../_shared/aiClient.ts";
import { requireUser, authErrorResponse } from "../_shared/callerAuth.ts";
import { UnsupportedFileError } from "../_shared/extractText.ts";
import { markStatus, runOnboardingTriage } from "../_shared/triageRunner.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const STALE_PROCESSING_MS = 10 * 60 * 1000;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  let documentId = "";
  let accessConfirmed = false;
  const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, {
    auth: { persistSession: false },
  });

  try {
    // 1. Who is calling?
    const { userClient } = await requireUser(req);

    const body = await req.json().catch(() => ({}));
    documentId = typeof body?.documentId === "string" ? body.documentId : "";
    if (!UUID_RE.test(documentId)) return json({ error: "documentId required" }, 400);

    // 2. Can they see this document? (row-level security decides)
    const { data: doc } = await userClient
      .from("client_onboarding_documents")
      .select("id, client_id, file_name, file_path, mime_type, status, updated_at")
      .eq("id", documentId)
      .maybeSingle();
    if (!doc) return json({ error: "Document not found" }, 404);
    accessConfirmed = true;

    // 3. Don't run twice at once (protects AI spend).
    if (doc.status === "processing" && Date.now() - new Date(doc.updated_at).getTime() < STALE_PROCESSING_MS) {
      return json({ status: "processing" }, 409);
    }

    // 4. Only now use the service role, for this one document.
    await runOnboardingTriage(admin, doc);
    return json({ status: "triaged" });
  } catch (err) {
    const authResp = authErrorResponse(err, corsHeaders);
    if (authResp) return authResp;

    const friendly = err instanceof UnsupportedFileError;
    if (accessConfirmed) {
      await markStatus(admin, documentId, "failed", friendly ? (err as Error).message : "Processing failed. Please try again.");
    }
    if (friendly) return json({ status: "failed", error: (err as Error).message }, 422);
    console.error("[triage-onboarding-document]", err);
    return aiErrorResponse(err, corsHeaders);
  }
});
