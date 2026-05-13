import { createClient } from "https://esm.sh/@supabase/supabase-js@2.95.0";
import { corsHeaders } from "https://esm.sh/@supabase/supabase-js@2.95.0/cors";

const BUCKET = "solicitation-documents";
const ALLOWED_EXT = [
  "pdf", "doc", "docx", "xls", "xlsx", "ppt", "pptx", "txt", "csv",
];
const MAX_BYTES = 50 * 1024 * 1024;
const CONCURRENCY = 3;

function sanitize(name: string) {
  return name.replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 180);
}

function extFromName(name: string): string | null {
  const m = name.toLowerCase().match(/\.([a-z0-9]+)(?:\?|#|$)/);
  return m ? m[1] : null;
}

function extFromContentType(ct: string | null): string | null {
  if (!ct) return null;
  const c = ct.toLowerCase();
  if (c.includes("pdf")) return "pdf";
  if (c.includes("wordprocessingml")) return "docx";
  if (c.includes("msword")) return "doc";
  if (c.includes("spreadsheetml")) return "xlsx";
  if (c.includes("ms-excel")) return "xls";
  if (c.includes("presentationml")) return "pptx";
  if (c.includes("ms-powerpoint")) return "ppt";
  if (c.includes("csv")) return "csv";
  if (c.includes("text/plain")) return "txt";
  return null;
}

function filenameFromHeaders(headers: Headers, fallbackUrl: string): string {
  const cd = headers.get("content-disposition") ?? "";
  const m = /filename\*?=(?:UTF-8''|")?([^";]+)/i.exec(cd);
  if (m) {
    try {
      return decodeURIComponent(m[1].replace(/"/g, "").trim());
    } catch {
      return m[1].replace(/"/g, "").trim();
    }
  }
  try {
    const u = new URL(fallbackUrl);
    const last = u.pathname.split("/").filter(Boolean).pop();
    if (last) return decodeURIComponent(last);
  } catch { /* ignore */ }
  return "attachment";
}

function mimeFromExt(ext: string): string | null {
  switch (ext) {
    case "pdf": return "application/pdf";
    case "doc": return "application/msword";
    case "docx": return "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
    case "xls": return "application/vnd.ms-excel";
    case "xlsx": return "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
    case "ppt": return "application/vnd.ms-powerpoint";
    case "pptx": return "application/vnd.openxmlformats-officedocument.presentationml.presentation";
    case "txt": return "text/plain";
    case "csv": return "text/csv";
    default: return null;
  }
}

function classify(name: string): string {
  const f = name.toLowerCase();
  if (f.includes("amend")) return "amendment";
  if (f.includes("sow") || f.includes("statement-of-work") || f.includes("statement of work")) return "sow";
  if (f.includes("q&a") || f.includes("qa") || f.includes("questions")) return "qa_log";
  if (f.includes("pricing") || f.includes("cost")) return "pricing_sheet";
  if (f.includes("evaluation")) return "evaluation_criteria";
  if (f.includes("rfp")) return "rfp";
  if (f.includes("rfq")) return "rfq";
  if (f.includes("rfi")) return "rfi";
  if (f.includes("attachment") || f.includes("exhibit") || f.includes("appendix")) return "attachment";
  return "other";
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Missing authorization" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;

    const userClient = createClient(SUPABASE_URL, ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    });
    const admin = createClient(SUPABASE_URL, SERVICE_KEY);

    // Resolve caller and load their personal SAM.gov key (use admin to validate token)
    const token = authHeader.replace(/^Bearer\s+/i, "").trim();
    const { data: userData } = await admin.auth.getUser(token);
    const userId = userData?.user?.id;
    if (!userId) {
      return new Response(
        JSON.stringify({ error: "UNAUTHENTICATED", message: "Sign in to import from SAM.gov." }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }
    const { data: keyRow } = await admin
      .from("user_integrations")
      .select("api_key")
      .eq("user_id", userId)
      .eq("provider", "sam_gov")
      .maybeSingle();
    const SAM_KEY = (keyRow as { api_key?: string } | null)?.api_key?.trim() ?? "";
    if (!SAM_KEY) {
      return new Response(
        JSON.stringify({ error: "SAM_KEY_MISSING", message: "Add your SAM.gov API key in Settings → Integrations." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const body = await req.json().catch(() => null) as
      | { solicitationId?: string; attachments?: { href: string; fileName?: string }[] }
      | null;

    const solicitationId = body?.solicitationId;
    const attachments = (body?.attachments ?? []).filter((a) => a && typeof a.href === "string");
    if (!solicitationId || attachments.length === 0) {
      return new Response(JSON.stringify({ error: "Missing solicitationId or attachments" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Verify caller can write to this solicitation, fetch org/client
    const { data: sol, error: solErr } = await userClient
      .from("solicitations")
      .select("id, client_id, clients!inner(organization_id)")
      .eq("id", solicitationId)
      .maybeSingle();

    if (solErr || !sol) {
      return new Response(JSON.stringify({ error: "Solicitation not found or access denied" }), {
        status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const orgId = (sol as { clients: { organization_id: string } }).clients.organization_id;
    const clientId = (sol as { client_id: string }).client_id;

    type Result = { href: string; ok: boolean; documentId?: string; error?: string; fileName?: string; status?: number };
    const results: Result[] = [];

    // Auto-create an "Amendment" revision when this batch contains any amendment files.
    // All docs in the batch get assigned to that new revision so the comparison timeline
    // can pair them as a coherent package. Non-amendment imports fall back to the latest
    // existing revision (typically the synthetic "Initial" one).
    const batchHasAmendment = attachments.some(
      (a) => classify(a.fileName || a.href) === "amendment",
    );

    let targetRevisionId: string | null = null;
    try {
      const { data: existingRevs } = await admin
        .from("solicitation_revisions")
        .select("id, kind, sequence, label")
        .eq("solicitation_id", solicitationId)
        .order("sequence", { ascending: false });

      const revs = (existingRevs ?? []) as { id: string; kind: string; sequence: number; label: string }[];

      if (batchHasAmendment) {
        const amendmentCount = revs.filter((r) => r.kind === "amendment").length;
        const nextSeq = (revs[0]?.sequence ?? 0) + 1;
        const label = `Amendment ${String(amendmentCount + 1).padStart(4, "0")}`;
        const { data: newRev, error: revErr } = await admin
          .from("solicitation_revisions")
          .insert({
            solicitation_id: solicitationId,
            label,
            kind: "amendment",
            sequence: nextSeq,
            source: "sam",
            received_at: new Date().toISOString(),
            created_by: userId,
          })
          .select("id")
          .single();
        if (revErr) {
          console.warn("revision auto-create failed", revErr);
        } else {
          targetRevisionId = (newRev as { id: string }).id;
        }
      } else if (revs.length > 0) {
        targetRevisionId = revs[0].id;
      }
    } catch (e) {
      console.warn("revision lookup failed", e);
    }

    const queue = [...attachments];
    async function worker() {
      while (queue.length) {
        const att = queue.shift()!;
        let httpStatus: number | undefined;
        try {
          // Append SAM api key for any *.sam.gov host
          let url = att.href;
          try {
            const u = new URL(url);
            if (SAM_KEY && /(^|\.)sam\.gov$/i.test(u.hostname) && !u.searchParams.get("api_key")) {
              u.searchParams.set("api_key", SAM_KEY);
              url = u.toString();
            }
          } catch { /* ignore */ }

          const res = await fetch(url, { redirect: "follow" });
          httpStatus = res.status;
          const contentType = res.headers.get("content-type") || "application/octet-stream";

          if (!res.ok) {
            const body = await res.text().catch(() => "");
            console.warn("sam-attachment download failed", { href: att.href, status: res.status, body: body.slice(0, 200) });
            throw new Error(`Download failed (${res.status}): ${body.slice(0, 160) || res.statusText}`);
          }

          // Reject obvious error pages even when status is 200
          const ctLower = contentType.toLowerCase();
          if (ctLower.startsWith("text/html") || ctLower.startsWith("application/json")) {
            const body = await res.text().catch(() => "");
            console.warn("sam-attachment unexpected content-type", { href: att.href, contentType, body: body.slice(0, 200) });
            throw new Error(`SAM.gov returned ${contentType} (likely an error). ${body.slice(0, 140)}`);
          }

          const rawName = att.fileName || filenameFromHeaders(res.headers, res.url || url);
          let ext = extFromName(rawName) || extFromContentType(contentType) || "";
          let fileName = rawName;
          if (!extFromName(fileName) && ext) fileName = `${rawName}.${ext}`;
          if (!extFromName(fileName)) fileName = `attachment-${crypto.randomUUID().slice(0, 8)}`;
          ext = (extFromName(fileName) ?? "").toLowerCase();

          console.log("sam-attachment", { href: att.href, status: res.status, contentType, fileName, ext });

          if (!ALLOWED_EXT.includes(ext)) {
            results.push({ href: att.href, ok: false, error: `Unsupported type .${ext || "?"}`, fileName, status: httpStatus });
            continue;
          }

          const buf = new Uint8Array(await res.arrayBuffer());
          if (buf.byteLength > MAX_BYTES) {
            results.push({ href: att.href, ok: false, error: "File exceeds 50MB", fileName, status: httpStatus });
            continue;
          }

          const docId = crypto.randomUUID();
          const safe = sanitize(fileName);
          const path = `${orgId}/${clientId}/${solicitationId}/${docId}/${safe}`;

          const uploadContentType = mimeFromExt(ext) ?? contentType;
          const { error: upErr } = await admin.storage
            .from(BUCKET)
            .upload(path, buf, { cacheControl: "3600", upsert: false, contentType: uploadContentType });
          if (upErr) throw upErr;

          const { error: insErr } = await admin.from("documents").insert({
            id: docId,
            solicitation_id: solicitationId,
            revision_id: targetRevisionId,
            file_name: fileName,
            file_path: path,
            file_size: buf.byteLength,
            file_type: uploadContentType,
            document_type: classify(fileName),
            status: "uploading",
            version: 1,
            is_current: true,
          });
          if (insErr) {
            await admin.storage.from(BUCKET).remove([path]);
            throw insErr;
          }

          // Fire-and-forget process
          admin.functions.invoke("process-document", { body: { documentId: docId } }).catch(() => {});

          results.push({ href: att.href, ok: true, documentId: docId, fileName, status: httpStatus });
        } catch (e) {
          const msg = e instanceof Error ? e.message : String(e);
          console.error("sam-attachment failed", { href: att.href, error: msg });
          results.push({ href: att.href, ok: false, error: msg, status: httpStatus });
        }
      }
    }

    await Promise.all(Array.from({ length: Math.min(CONCURRENCY, attachments.length) }, () => worker()));

    const imported = results.filter((r) => r.ok).length;
    const failed = results.filter((r) => !r.ok);

    return new Response(JSON.stringify({ imported, total: attachments.length, failed, results }), {
      status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("sam-import-attachments error", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : String(e) }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
