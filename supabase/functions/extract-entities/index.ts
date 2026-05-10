import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const ENTITY_TYPES = [
  "requirement",
  "date",
  "deadline",
  "dollar_amount",
  "organization",
  "person",
  "certification",
  "compliance",
] as const;

type ExtractedEntity = {
  entity_type: (typeof ENTITY_TYPES)[number];
  entity_value: string;
  normalized_value?: string | null;
  context_snippet?: string | null;
  page_number?: number | null;
  section_reference?: string | null;
  confidence_score?: number | null;
};

function getServiceClient() {
  return createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );
}

async function callAI(text: string): Promise<ExtractedEntity[]> {
  const apiKey = Deno.env.get("LOVABLE_API_KEY");
  if (!apiKey) throw new Error("LOVABLE_API_KEY not configured");

  // Truncate for token budget
  const MAX = 60_000;
  const slice = text.length > MAX ? text.slice(0, MAX) : text;

  const systemPrompt = `You extract entities from US government solicitation documents (RFPs/RFQs).
Return ONLY entities you find. Be precise. Use these entity_type values exactly:
- requirement: shall/must/will statements expressing a binding requirement
- date: any specific date mentioned
- deadline: a date that is explicitly a due date or deadline
- dollar_amount: monetary values in USD
- organization: agencies, companies, contracting offices
- person: individuals named in the doc (contracting officers, POCs)
- certification: required certifications (e.g., FedRAMP, ISO 27001, CMMC)
- compliance: compliance requirements (e.g., FAR clauses, Section 508)

For each entity include a short context_snippet (under 200 chars) showing surrounding text,
and a confidence_score between 0 and 1.`;

  const tool = {
    name: "save_entities",
    description: "Save the entities extracted from the document",
    parameters: {
      type: "object",
      properties: {
        entities: {
          type: "array",
          items: {
            type: "object",
            properties: {
              entity_type: { type: "string", enum: [...ENTITY_TYPES] },
              entity_value: { type: "string" },
              normalized_value: { type: "string" },
              context_snippet: { type: "string" },
              confidence_score: { type: "number", minimum: 0, maximum: 1 },
            },
            required: ["entity_type", "entity_value"],
          },
        },
      },
      required: ["entities"],
    },
  };

  const args = await callAiTool({
    functionName: "extract-entities",
    system: systemPrompt,
    user: slice,
    tool,
  });
  const list = Array.isArray((args as any).entities) ? (args as any).entities : [];
  return list.filter(
    (e: ExtractedEntity) =>
      e &&
      ENTITY_TYPES.includes(e.entity_type) &&
      typeof e.entity_value === "string" &&
      e.entity_value.length > 0
  );
}

function findContextAndPage(haystack: string, needle: string): {
  snippet: string;
  page: number | null;
} {
  if (!needle) return { snippet: "", page: null };
  const idx = haystack.indexOf(needle);
  if (idx < 0) return { snippet: needle.slice(0, 200), page: null };
  const start = Math.max(0, idx - 50);
  const end = Math.min(haystack.length, idx + needle.length + 50);
  // Estimate page from position assuming ~3000 chars per page
  const page = Math.max(1, Math.floor(idx / 3000) + 1);
  return { snippet: haystack.slice(start, end).replace(/\s+/g, " ").trim(), page };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  const supabase = getServiceClient();
  let documentId: string | undefined;

  try {
    const body = await req.json().catch(() => ({}));
    documentId = body.documentId;
    if (!documentId) {
      return new Response(JSON.stringify({ error: "documentId required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: doc, error } = await supabase
      .from("documents")
      .select("id, extracted_text, status")
      .eq("id", documentId)
      .maybeSingle();
    if (error) throw error;
    if (!doc) {
      return new Response(JSON.stringify({ error: "Document not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (!doc.extracted_text) {
      return new Response(JSON.stringify({ error: "Document has no extracted text" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const entities = await callAI(doc.extracted_text);

    // Replace prior entities for idempotency
    await supabase.from("extracted_entities").delete().eq("document_id", documentId);

    if (entities.length > 0) {
      const rows = entities.map((e) => {
        const ctx = findContextAndPage(doc.extracted_text!, e.entity_value);
        return {
          document_id: documentId!,
          entity_type: e.entity_type,
          entity_value: e.entity_value,
          normalized_value: e.normalized_value ?? null,
          context_snippet: e.context_snippet ?? ctx.snippet,
          page_number: ctx.page,
          confidence_score: e.confidence_score ?? null,
        };
      });
      const { error: insErr } = await supabase.from("extracted_entities").insert(rows);
      if (insErr) throw insErr;
    }

    await supabase
      .from("documents")
      .update({
        status: "analyzed",
        processing_completed_at: new Date().toISOString(),
        processing_error: null,
      })
      .eq("id", documentId);

    return new Response(JSON.stringify({ ok: true, entities: entities.length }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    console.error("extract-entities failed:", message);
    if (documentId) {
      await supabase
        .from("documents")
        .update({
          status: "failed",
          processing_error: message.slice(0, 2000),
        })
        .eq("id", documentId);
    }
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
