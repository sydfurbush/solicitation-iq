import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { callAiTool, aiErrorResponse } from "../_shared/aiClient.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

// Register model config for this function in shared aiClient.ts MODEL_CONFIG if you want
// per-function tuning. For now we hard-code through the lovable provider via a one-off entry.
// We add it inline by setting a default.
const SYSTEM_PROMPT = `You are a federal contracting specialist drafting a formal clarification request to a contracting officer.

You will receive ONE strategic question that the client has chosen to send to the agency, along with the client's note explaining their concern and the source citation from the solicitation.

Produce a concise, professional, four-part clarification item suitable for inclusion in a Q&A package submitted to the agency. Use neutral, respectful, contracting-officer tone — never adversarial. Do NOT reveal competitive intent.

Return ONLY structured output via the tool. Do not narrate.`;

const TOOL_SCHEMA = {
  name: "clarification_request",
  description: "Formal clarification request, four parts.",
  parameters: {
    type: "object",
    additionalProperties: false,
    required: ["reference", "quoted_text", "concern", "requested_clarification"],
    properties: {
      reference: {
        type: "string",
        description:
          "Specific location: document name, section number, paragraph, page (e.g. 'PWS Section 3.2.1, Paragraph (b), Page 14').",
      },
      quoted_text: {
        type: "string",
        description: "Verbatim excerpt from the solicitation, max ~280 chars. Use exact wording.",
      },
      concern: {
        type: "string",
        description: "Plain-English statement of the ambiguity, conflict, or missing information (1-3 sentences).",
      },
      requested_clarification: {
        type: "string",
        description:
          "The actual question to the agency, phrased professionally. End with a question mark. 1-2 sentences.",
      },
    },
  },
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const { questionId } = await req.json();
    if (!questionId || typeof questionId !== "string") {
      return new Response(JSON.stringify({ error: "questionId required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    const { data: q, error: qErr } = await admin
      .from("strategic_questions")
      .select("*, solicitation:solicitations(title, solicitation_number, issuing_agency)")
      .eq("id", questionId)
      .maybeSingle();
    if (qErr || !q) {
      return new Response(JSON.stringify({ error: "question not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const sol = (q as any).solicitation ?? {};
    const userPrompt = `SOLICITATION
Title: ${sol.title ?? "—"}
Number: ${sol.solicitation_number ?? "—"}
Agency: ${sol.issuing_agency ?? "—"}

ORIGINAL STRATEGIC QUESTION
${q.question_text}

ANALYST RATIONALE
${q.question_rationale ?? "—"}

CLIENT NOTE / CONCERN
${q.client_note ?? "(no note provided)"}

SOURCE CITATION
${q.source_citation ?? "—"}

SOURCE QUOTE
${q.source_quote ?? "(no verbatim quote on file — derive a likely reference from the citation above)"}

Draft a formal four-part clarification item.`;

    const result = (await callAiTool({
      functionName: "draft-clarification-request",
      system: SYSTEM_PROMPT,
      user: userPrompt,
      tool: TOOL_SCHEMA,
    })) as {
      reference: string;
      quoted_text: string;
      concern: string;
      requested_clarification: string;
    };

    const draft = [
      `**Reference:** ${result.reference}`,
      "",
      `**Quoted text:** "${result.quoted_text}"`,
      "",
      `**Concern:** ${result.concern}`,
      "",
      `**Requested clarification:** ${result.requested_clarification}`,
    ].join("\n");

    const { error: upErr } = await admin
      .from("strategic_questions")
      .update({ clarification_draft: draft, clarification_status: "drafting" })
      .eq("id", questionId);
    if (upErr) throw upErr;

    return new Response(JSON.stringify({ ok: true, draft, parts: result }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("draft-clarification-request error", err);
    return aiErrorResponse(err, corsHeaders);
  }
});
