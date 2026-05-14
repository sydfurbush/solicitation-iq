import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.45.0";
import { callAiTool, aiErrorResponse } from "../_shared/aiClient.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Fields we attempt to auto-fill on the solicitations row.
const FIELDS = [
  "release_date",
  "questions_due_date",
  "proposal_due_date",
  "expected_award_date",
  "period_of_performance_start",
  "period_of_performance_end",
  "estimated_value_low",
  "estimated_value_high",
  "issuing_agency",
  "agency_type",
  "contract_type",
  "set_aside",
  "solicitation_number",
  "incumbent_name",
  "incumbent_contract_number",
] as const;

type FieldName = (typeof FIELDS)[number];

const DATE_FIELDS = new Set<FieldName>([
  "release_date",
  "questions_due_date",
  "proposal_due_date",
  "expected_award_date",
  "period_of_performance_start",
  "period_of_performance_end",
]);

const NUMERIC_FIELDS = new Set<FieldName>(["estimated_value_low", "estimated_value_high"]);

function getServiceClient() {
  return createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
}

function isEmpty(v: unknown) {
  return v === null || v === undefined || v === "";
}

function normalize(field: FieldName, value: unknown): unknown {
  if (isEmpty(value)) return null;
  if (DATE_FIELDS.has(field)) {
    const d = new Date(String(value));
    if (Number.isNaN(d.getTime())) return null;
    return d.toISOString().slice(0, 10); // YYYY-MM-DD
  }
  if (NUMERIC_FIELDS.has(field)) {
    const n = Number(String(value).replace(/[$,]/g, ""));
    return Number.isFinite(n) ? n : null;
  }
  return String(value).trim();
}

function sameValue(a: unknown, b: unknown) {
  if (isEmpty(a) && isEmpty(b)) return true;
  return String(a ?? "").trim().toLowerCase() === String(b ?? "").trim().toLowerCase();
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  const supabase = getServiceClient();

  try {
    const body = await req.json().catch(() => ({}));
    const solicitationId: string | undefined = body.solicitationId;
    if (!solicitationId) {
      return new Response(JSON.stringify({ error: "solicitationId required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: sol, error: solErr } = await supabase
      .from("solicitations")
      .select(
        FIELDS.join(", ") + ", id, has_incumbent, overview_autofill"
      )
      .eq("id", solicitationId)
      .maybeSingle();
    if (solErr) throw solErr;
    if (!sol) {
      return new Response(JSON.stringify({ error: "Solicitation not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Pull entities from all current docs for this solicitation.
    const { data: docs } = await supabase
      .from("documents")
      .select("id, file_name")
      .eq("solicitation_id", solicitationId)
      .is("deleted_at", null);

    const docIds = (docs ?? []).map((d) => d.id);
    if (!docIds.length) {
      return new Response(JSON.stringify({ ok: true, filled: 0, proposed: 0, reason: "no documents" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: entities } = await supabase
      .from("extracted_entities")
      .select("document_id, entity_type, entity_value, normalized_value, context_snippet, page_number, confidence_score")
      .in("document_id", docIds);

    const docNameById = new Map((docs ?? []).map((d) => [d.id, d.file_name]));

    // Build a compact context for the model.
    const compact = (entities ?? [])
      .filter((e) =>
        ["date", "deadline", "dollar_amount", "organization", "person", "certification", "compliance"].includes(
          e.entity_type
        )
      )
      .slice(0, 400)
      .map((e) => ({
        doc: docNameById.get(e.document_id) ?? "",
        doc_id: e.document_id,
        type: e.entity_type,
        value: e.entity_value,
        normalized: e.normalized_value,
        context: e.context_snippet,
        page: e.page_number,
      }));

    const systemPrompt = `You map US government solicitation entities to a fixed set of overview fields.
Return ONLY fields you can confidently identify from the entities provided.
For each field include: value (in the requested format), the source document name (from doc), the supporting quote (short, verbatim from context), and a confidence between 0 and 1.

Field formats:
- *_date fields: ISO YYYY-MM-DD
- estimated_value_low / estimated_value_high: numeric USD without $ or commas
- agency_type: one of "Federal", "State", "Local", "Private"
- set_aside: short label like "8(a)", "Small Business", "WOSB", "SDVOSB", "HUBZone", "Other", "None"
- contract_type: short label like "FFP", "T&M", "IDIQ", "BPA", "Cost Plus", etc.
- All others: plain string

If a field has no clear evidence, omit it entirely. Do not guess.`;

    const fieldProps: Record<string, unknown> = {};
    for (const f of FIELDS) {
      fieldProps[f] = {
        type: "object",
        properties: {
          value: { type: ["string", "number"] },
          source_document: { type: "string" },
          quote: { type: "string" },
          confidence: { type: "number", minimum: 0, maximum: 1 },
        },
        required: ["value"],
      };
    }

    const tool = {
      name: "save_overview_fields",
      description: "Save inferred overview field values from extracted entities.",
      parameters: {
        type: "object",
        properties: { fields: { type: "object", properties: fieldProps } },
        required: ["fields"],
      },
    };

    let aiOut: Record<string, unknown> = {};
    try {
      aiOut = await callAiTool({
        functionName: "reconcile-solicitation-overview",
        system: systemPrompt,
        user: `KNOWN ENTITIES (truncated):\n${JSON.stringify(compact).slice(0, 80_000)}`,
        tool,
      });
    } catch (e) {
      console.error("[reconcile] AI call failed", e);
      return aiErrorResponse(e, corsHeaders);
    }

    const fields = (aiOut.fields ?? {}) as Record<
      string,
      { value: unknown; source_document?: string; quote?: string; confidence?: number } | undefined
    >;

    const updatePayload: Record<string, unknown> = {};
    const autofill = (sol as Record<string, unknown>).overview_autofill as Record<string, unknown> | null;
    const newAutofill: Record<string, unknown> = { ...(autofill ?? {}) };
    const proposals: Array<{
      field_name: string;
      current_value: unknown;
      proposed_value: unknown;
      confidence: number | null;
      source_document_id: string | null;
      source_quote: string | null;
    }> = [];

    let filled = 0;
    for (const f of FIELDS) {
      const entry = fields[f];
      if (!entry || isEmpty(entry.value)) continue;
      const proposed = normalize(f, entry.value);
      if (proposed === null) continue;

      const sourceDocName = entry.source_document ?? "";
      const sourceDocId =
        (docs ?? []).find((d) => d.file_name === sourceDocName)?.id ??
        (docs ?? [])[0]?.id ??
        null;

      const current = (sol as Record<string, unknown>)[f];
      const previousAutofill = (autofill ?? {})[f] as { source_document_id?: string } | undefined;

      if (isEmpty(current)) {
        // Auto-fill empty field
        updatePayload[f] = proposed;
        newAutofill[f] = {
          source_document_id: sourceDocId,
          source_document_name: sourceDocName,
          quote: (entry.quote ?? "").slice(0, 400),
          confidence: entry.confidence ?? null,
          filled_at: new Date().toISOString(),
        };
        filled += 1;
        if (f === "incumbent_name" || f === "incumbent_contract_number") {
          updatePayload.has_incumbent = true;
        }
      } else if (sameValue(current, proposed)) {
        // confirms existing — bump provenance only if previously empty
        if (!previousAutofill) {
          newAutofill[f] = {
            ...(previousAutofill ?? {}),
            source_document_id: sourceDocId,
            confirmed_at: new Date().toISOString(),
          };
        }
      } else if (previousAutofill) {
        // Field was auto-filled before; treat new value as a refinement (overwrite)
        updatePayload[f] = proposed;
        newAutofill[f] = {
          source_document_id: sourceDocId,
          source_document_name: sourceDocName,
          quote: (entry.quote ?? "").slice(0, 400),
          confidence: entry.confidence ?? null,
          filled_at: new Date().toISOString(),
        };
        filled += 1;
      } else {
        // Conflict with analyst-curated value → propose, don't overwrite
        proposals.push({
          field_name: f,
          current_value: current as unknown,
          proposed_value: proposed,
          confidence: entry.confidence ?? null,
          source_document_id: sourceDocId,
          source_quote: (entry.quote ?? "").slice(0, 400) || null,
        });
      }
    }

    // Apply auto-fills
    if (Object.keys(updatePayload).length > 0) {
      updatePayload.overview_autofill = newAutofill;
      const { error } = await supabase
        .from("solicitations")
        .update(updatePayload)
        .eq("id", solicitationId);
      if (error) throw error;
    } else if (Object.keys(newAutofill).length !== Object.keys(autofill ?? {}).length) {
      await supabase
        .from("solicitations")
        .update({ overview_autofill: newAutofill })
        .eq("id", solicitationId);
    }

    // Supersede prior pending proposals for the same fields, then insert new ones
    if (proposals.length) {
      const fieldsToSupersede = proposals.map((p) => p.field_name);
      await supabase
        .from("solicitation_field_proposals")
        .update({ status: "superseded" })
        .eq("solicitation_id", solicitationId)
        .eq("status", "pending")
        .in("field_name", fieldsToSupersede);

      const rows = proposals.map((p) => ({
        solicitation_id: solicitationId,
        field_name: p.field_name,
        current_value: p.current_value as never,
        proposed_value: p.proposed_value as never,
        confidence: p.confidence,
        source_document_id: p.source_document_id,
        source_quote: p.source_quote,
        status: "pending" as const,
      }));
      const { error } = await supabase.from("solicitation_field_proposals").insert(rows);
      if (error) throw error;
    }

    return new Response(
      JSON.stringify({ ok: true, filled, proposed: proposals.length }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    console.error("[reconcile-solicitation-overview] error", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : String(e) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
