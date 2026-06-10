import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { chunkText, embedTexts, EmbeddingsUnavailableError } from "../_shared/embeddings.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

type Section = {
  id: string;
  content: string | null;
  page_start: number | null;
  section_title: string | null;
};

const MAX_CHUNK_CHARS = 800;
const CHUNK_OVERLAP = 100;
const EMBED_BATCH = 32;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const body = await req.json().catch(() => ({}));
    const supa = createClient(SUPABASE_URL, SERVICE_KEY);

    // Backfill mode: process every parsed document in a solicitation
    if (body.solicitationId && !body.documentId) {
      const { data: docs, error } = await supa
        .from("documents")
        .select("id")
        .eq("solicitation_id", body.solicitationId)
        .in("status", ["parsed", "analyzed"])
        .is("deleted_at", null);
      if (error) throw error;

      const results: any[] = [];
      for (const d of docs ?? []) {
        const r = await embedDocument(supa, d.id);
        results.push({ documentId: d.id, ...r });
      }
      return new Response(JSON.stringify({ ok: true, documents: results.length, results }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const documentId: string | undefined = body.documentId;
    if (!documentId) {
      return new Response(JSON.stringify({ error: "documentId or solicitationId is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const result = await embedDocument(supa, documentId);
    if ("error" in result) {
      return new Response(JSON.stringify(result), {
        status: result.status ?? 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    return new Response(JSON.stringify({ ok: true, ...result }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    console.error("[embed-document] failed:", message);
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

async function embedDocument(
  supa: ReturnType<typeof createClient>,
  documentId: string,
): Promise<
  | { chunks: number; embedded: number; embeddings_available: boolean }
  | { error: string; status?: number }
> {
    const { data: doc, error: docErr } = await supa
      .from("documents")
      .select("id, solicitation_id, file_name, deleted_at")
      .eq("id", documentId)
      .maybeSingle();
    if (docErr) throw docErr;
    if (!doc || doc.deleted_at) return { error: "document not found", status: 404 };

    const { data: sections, error: secErr } = await supa
      .from("document_sections")
      .select("id, content, page_start, section_title")
      .eq("document_id", documentId)
      .order("sort_order", { ascending: true });
    if (secErr) throw secErr;

    // Build chunks tied to their parent section
    const items: { sectionId: string | null; page: number | null; text: string }[] = [];
    for (const s of (sections ?? []) as Section[]) {
      const text = (s.content ?? "").trim();
      if (!text) continue;
      const pieces = chunkText(text, MAX_CHUNK_CHARS, CHUNK_OVERLAP);
      for (const piece of pieces) {
        items.push({ sectionId: s.id, page: s.page_start ?? null, text: piece });
      }
    }

    if (!items.length) {
      await supa.from("document_chunks").delete().eq("document_id", documentId);
      return { chunks: 0, embedded: 0, embeddings_available: true };
    }

    // Replace existing chunks atomically (delete-then-insert)
    const { error: delErr } = await supa.from("document_chunks").delete().eq("document_id", documentId);
    if (delErr) throw delErr;

    let embedded = 0;
    let embeddingsUnavailable = false;

    for (let i = 0; i < items.length; i += EMBED_BATCH) {
      const batch = items.slice(i, i + EMBED_BATCH);
      let vectors: number[][] | null = null;
      if (!embeddingsUnavailable) {
        try {
          vectors = await embedTexts(batch.map((b) => b.text));
          if (vectors.length !== batch.length) {
            throw new Error(`embedding count mismatch (${vectors.length} vs ${batch.length})`);
          }
        } catch (err) {
          if (err instanceof EmbeddingsUnavailableError) {
            console.warn("[embed-document] embeddings unavailable; storing chunks without vectors");
            embeddingsUnavailable = true;
            vectors = null;
          } else {
            throw err;
          }
        }
      }

      const rows = batch.map((b, j) => ({
        document_id: documentId,
        solicitation_id: doc.solicitation_id,
        section_id: b.sectionId,
        chunk_index: i + j,
        content: b.text,
        page_number: b.page,
        token_estimate: Math.ceil(b.text.length / 4),
        embedding: vectors ? (vectors[j] as unknown as string) : null,
      }));

      const { error: insErr } = await supa.from("document_chunks").insert(rows);
      if (insErr) throw insErr;
      if (vectors) embedded += vectors.length;
    }

    return { chunks: items.length, embedded, embeddings_available: !embeddingsUnavailable };
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    console.error("[embed-document] embedDocument failed:", message);
    return { error: message };
  }
}

