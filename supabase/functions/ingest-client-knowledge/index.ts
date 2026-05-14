// Ingests a client knowledge document: extracts text, chunks, embeds, and writes chunks.
// Triggered after a document row is created (status=pending).

import { Buffer } from "node:buffer";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { z } from "npm:zod@3.23.8";
import pdfParse from "npm:pdf-parse@1.1.1";
import mammoth from "npm:mammoth@1.6.0";
import * as XLSX from "npm:xlsx@0.18.5";
import { chunkText, embedTexts, EmbeddingsUnavailableError } from "../_shared/embeddings.ts";

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
  const lowerPath = filePath.toLowerCase();
  const lowerMime = (mimeType ?? "").toLowerCase();
  const bytes = new Uint8Array(await data.arrayBuffer());

  if (lowerMime === "application/pdf" || lowerPath.endsWith(".pdf")) {
    const result = await pdfParse(Buffer.from(bytes));
    return result.text ?? "";
  }
  if (
    lowerPath.endsWith(".docx") ||
    lowerPath.endsWith(".doc") ||
    lowerMime === "application/vnd.openxmlformats-officedocument.wordprocessingml.document" ||
    lowerMime === "application/msword"
  ) {
    const { value } = await mammoth.extractRawText({ buffer: Buffer.from(bytes) });
    return value ?? "";
  }
  if (
    lowerPath.endsWith(".xlsx") ||
    lowerPath.endsWith(".xls") ||
    lowerMime.includes("sheet") ||
    lowerMime.includes("excel")
  ) {
    const wb = XLSX.read(bytes, { type: "array" });
    const parts: string[] = [];
    for (const name of wb.SheetNames) {
      parts.push(`=== ${name} ===`);
      parts.push(XLSX.utils.sheet_to_csv(wb.SheetNames ? wb.Sheets[name] : wb.Sheets[name]));
    }
    return parts.join("\n");
  }
  if (lowerMime.startsWith("text/") || lowerPath.endsWith(".txt") || lowerPath.endsWith(".md") || lowerPath.endsWith(".csv")) {
    return new TextDecoder().decode(bytes);
  }
  throw new Error(`Unsupported file type "${mimeType ?? "unknown"}". Upload PDF, Word, Excel, .txt, or .md.`);
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

    // Embed in batches; if the workspace lacks the embeddings endpoint, fall back
    // to keyword-only chunks (embedding column left NULL) so RAG still works via ILIKE.
    const BATCH = 32;
    let inserted = 0;
    let embedded = true;
    for (let i = 0; i < chunks.length; i += BATCH) {
      const batch = chunks.slice(i, i + BATCH);
      let vectors: number[][] | null = null;
      if (embedded) {
        try {
          vectors = await embedTexts(batch);
          if (vectors.length !== batch.length) {
            throw new Error(`embedding count mismatch (${vectors.length} vs ${batch.length})`);
          }
        } catch (e) {
          if (e instanceof EmbeddingsUnavailableError) {
            console.warn("[ingest-client-knowledge] embeddings unavailable; storing chunks without vectors");
            embedded = false;
            vectors = null;
          } else {
            throw e;
          }
        }
      }
      const rows = batch.map((content, j) => ({
        document_id: documentId,
        client_id: doc.client_id,
        chunk_index: i + j,
        content,
        token_estimate: Math.ceil(content.length / 4),
        embedding: vectors ? (vectors[j] as unknown as string) : null,
        metadata: { source_type: doc.source_type, title: doc.title },
      }));
      const { error: insErr } = await sb.from("client_knowledge_chunks").insert(rows);
      if (insErr) throw new Error(`insert chunks failed: ${insErr.message}`);
      inserted += rows.length;
    }

    await sb.from("client_knowledge_documents")
      .update({
        status: "ready",
        chunk_count: inserted,
        error: embedded ? null : "Stored without embeddings (workspace embeddings endpoint unavailable). Keyword search active.",
      })
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
