// Ingests a client knowledge document: extracts text, chunks, embeds, and writes chunks.
// Triggered after a document row is created (status=pending).

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { z } from "npm:zod@3.23.8";
import { chunkText, embedTexts } from "../_shared/embeddings.ts";

const Body = z.object({ documentId: z.string().uuid() });

function admin() {
  return createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    { auth: { persistSession: false } },
  );
}

async function readUploadedText(sb: ReturnType<typeof admin>, filePath: string, mimeType: string | null): Promise<string> {
  const { data, error } = await sb.storage.from("client-knowledge").download(filePath);
  if (error || !data) throw new Error(`download failed: ${error?.message ?? "no data"}`);
  const lower = (mimeType ?? "").toLowerCase();
  if (lower.startsWith("text/") || filePath.endsWith(".txt") || filePath.endsWith(".md")) {
    return await data.text();
  }
  // For now we accept text-like uploads only; richer formats land in a follow-up.
  throw new Error(`Unsupported file type "${mimeType ?? "unknown"}". Upload .txt or .md, or paste the text as a note.`);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const parsed = Body.safeParse(await req.json());
    if (!parsed.success) {
      return new Response(JSON.stringify({ error: parsed.error.flatten().fieldErrors }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const { documentId } = parsed.data;
    const sb = admin();

    const { data: doc, error: docErr } = await sb
      .from("client_knowledge_documents")
      .select("*")
      .eq("id", documentId)
      .maybeSingle();
    if (docErr || !doc) throw new Error(docErr?.message ?? "document not found");

    await sb.from("client_knowledge_documents")
      .update({ status: "embedding", error: null })
      .eq("id", documentId);

    // Resolve text content
    let text = "";
    if (doc.source_type === "note") {
      text = (doc.raw_text ?? "").trim();
    } else if (doc.source_type === "upload" && doc.file_path) {
      text = await readUploadedText(sb, doc.file_path, doc.mime_type);
    }
    if (!text) throw new Error("Document has no text to ingest");

    // Wipe any prior chunks (idempotent re-ingest)
    await sb.from("client_knowledge_chunks").delete().eq("document_id", documentId);

    const chunks = chunkText(text, 800, 100);
    if (!chunks.length) throw new Error("Text produced no chunks");

    // Embed in batches to stay under provider limits
    const BATCH = 32;
    let inserted = 0;
    for (let i = 0; i < chunks.length; i += BATCH) {
      const batch = chunks.slice(i, i + BATCH);
      const vectors = await embedTexts(batch);
      if (vectors.length !== batch.length) {
        throw new Error(`embedding count mismatch (${vectors.length} vs ${batch.length})`);
      }
      const rows = batch.map((content, j) => ({
        document_id: documentId,
        client_id: doc.client_id,
        chunk_index: i + j,
        content,
        token_estimate: Math.ceil(content.length / 4),
        embedding: vectors[j] as unknown as string,
        metadata: { source_type: doc.source_type, title: doc.title },
      }));
      const { error: insErr } = await sb.from("client_knowledge_chunks").insert(rows);
      if (insErr) throw new Error(`insert chunks failed: ${insErr.message}`);
      inserted += rows.length;
    }

    await sb.from("client_knowledge_documents")
      .update({ status: "ready", chunk_count: inserted, error: null })
      .eq("id", documentId);

    return new Response(JSON.stringify({ success: true, chunks: inserted }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("[ingest-client-knowledge] error", msg);
    try {
      const body = await req.clone().json().catch(() => ({}));
      const docId = (body as { documentId?: string }).documentId;
      if (docId) {
        await admin().from("client_knowledge_documents")
          .update({ status: "failed", error: msg.slice(0, 1000) })
          .eq("id", docId);
      }
    } catch { /* ignore */ }
    return new Response(JSON.stringify({ error: msg }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
