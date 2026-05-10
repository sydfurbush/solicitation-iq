import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.45.0";
import pdfParse from "npm:pdf-parse@1.1.1";
import mammoth from "npm:mammoth@1.6.0";
import * as XLSX from "npm:xlsx@0.18.5";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const BUCKET = "solicitation-documents";

type SectionDraft = {
  number: string | null;
  title: string;
  content: string;
  pageStart: number | null;
  pageEnd: number | null;
  depth: number;
  sortOrder: number;
};

function getServiceClient() {
  return createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );
}

async function extractText(
  fileBytes: Uint8Array,
  fileName: string,
  mime: string | null
): Promise<{ text: string; pages: number | null }> {
  const lower = fileName.toLowerCase();
  const buf = Buffer.from(fileBytes);

  if (mime === "application/pdf" || lower.endsWith(".pdf")) {
    const result = await pdfParse(buf);
    return { text: result.text ?? "", pages: result.numpages ?? null };
  }
  if (
    lower.endsWith(".docx") ||
    mime ===
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
  ) {
    const { value } = await mammoth.extractRawText({ buffer: buf });
    return { text: value ?? "", pages: null };
  }
  if (
    lower.endsWith(".xlsx") ||
    lower.endsWith(".xls") ||
    mime?.includes("sheet") ||
    mime?.includes("excel")
  ) {
    const wb = XLSX.read(fileBytes, { type: "array" });
    const parts: string[] = [];
    for (const name of wb.SheetNames) {
      parts.push(`=== ${name} ===`);
      parts.push(XLSX.utils.sheet_to_csv(wb.Sheets[name]));
    }
    return { text: parts.join("\n"), pages: wb.SheetNames.length };
  }
  if (lower.endsWith(".csv") || lower.endsWith(".txt") || mime?.startsWith("text/")) {
    return { text: new TextDecoder().decode(fileBytes), pages: null };
  }
  // Unsupported types — return empty text but not an error
  return { text: "", pages: null };
}

// Detect headings like "1.0", "1.1", "2.3.4 Title here"
function parseSections(text: string): SectionDraft[] {
  const lines = text.split(/\r?\n/);
  const sections: SectionDraft[] = [];
  let current: SectionDraft | null = null;
  const headingRe = /^\s*(\d+(?:\.\d+){0,4})[\s.\-)]+(.{2,160})$/;

  let order = 0;
  for (const raw of lines) {
    const line = raw.trim();
    if (!line) {
      if (current) current.content += "\n";
      continue;
    }
    const m = headingRe.exec(line);
    if (m) {
      if (current) sections.push(current);
      const number = m[1];
      const depth = number.split(".").length - 1;
      current = {
        number,
        title: m[2].trim().slice(0, 200),
        content: "",
        pageStart: null,
        pageEnd: null,
        depth,
        sortOrder: order++,
      };
    } else if (current) {
      current.content += (current.content ? "\n" : "") + line;
    } else {
      // pre-heading body — accumulate as introduction
      if (sections.length === 0) {
        current = {
          number: null,
          title: "Introduction",
          content: line,
          pageStart: null,
          pageEnd: null,
          depth: 0,
          sortOrder: order++,
        };
      }
    }
  }
  if (current) sections.push(current);
  return sections;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const supabase = getServiceClient();
  let documentId: string | undefined;

  try {
    const body = await req.json().catch(() => ({}));
    documentId = body.documentId;
    if (!documentId || typeof documentId !== "string") {
      return new Response(JSON.stringify({ error: "documentId required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: doc, error: docErr } = await supabase
      .from("documents")
      .select("*")
      .eq("id", documentId)
      .maybeSingle();
    if (docErr) throw docErr;
    if (!doc) {
      return new Response(JSON.stringify({ error: "Document not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    await supabase
      .from("documents")
      .update({
        status: "processing",
        processing_started_at: new Date().toISOString(),
        processing_error: null,
      })
      .eq("id", documentId);

    // Download from storage
    const { data: blob, error: dlErr } = await supabase.storage
      .from(BUCKET)
      .download(doc.file_path);
    if (dlErr || !blob) throw new Error(`Download failed: ${dlErr?.message ?? "no data"}`);
    const bytes = new Uint8Array(await blob.arrayBuffer());

    const { text, pages } = await extractText(bytes, doc.file_name, doc.file_type);
    const sections = parseSections(text);

    // Replace previous sections for idempotency
    await supabase.from("document_sections").delete().eq("document_id", documentId);

    if (sections.length > 0) {
      const rows = sections.map((s) => ({
        document_id: documentId!,
        section_number: s.number,
        section_title: s.title,
        content: s.content,
        depth: s.depth,
        sort_order: s.sortOrder,
        page_start: s.pageStart,
        page_end: s.pageEnd,
      }));
      const { error: insErr } = await supabase.from("document_sections").insert(rows);
      if (insErr) throw insErr;
    }

    await supabase
      .from("documents")
      .update({
        status: "parsed",
        extracted_text: text.slice(0, 5_000_000),
        total_pages: pages ?? doc.total_pages,
        processing_completed_at: new Date().toISOString(),
        processing_error: null,
      })
      .eq("id", documentId);

    // Trigger entity extraction (fire and forget)
    EdgeRuntime.waitUntil(
      fetch(`${Deno.env.get("SUPABASE_URL")}/functions/v1/extract-entities`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}`,
        },
        body: JSON.stringify({ documentId }),
      }).catch((e) => console.error("extract-entities trigger failed:", e))
    );

    return new Response(
      JSON.stringify({ ok: true, sections: sections.length, pages, chars: text.length }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    console.error("process-document failed:", message);
    if (documentId) {
      await supabase
        .from("documents")
        .update({
          status: "failed",
          processing_error: message.slice(0, 2000),
          processing_completed_at: new Date().toISOString(),
        })
        .eq("id", documentId);
    }
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
