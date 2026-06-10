import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { aiErrorResponse, callAiTool } from "../_shared/aiClient.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const SYSTEM_PROMPT = `You are a proposal-strategy AI assistant scoped to ONE specific government solicitation.
You may only answer questions using the context provided below (the solicitation overview, risks, opportunities,
requirements, strategic questions, client profile, capabilities, teaming/incumbents, reports, and verbatim
document excerpts retrieved from the uploaded solicitation files). If the user asks something outside this
solicitation, politely refuse and redirect.

PREFER answers grounded in the "# Document excerpts" block — it contains the actual text of the solicitation
documents and is your primary source of truth. When you state a fact from an excerpt, cite the exact bracketed
label provided (e.g. [Doc: filename §3.2 p.14]). For structured items, use labels like [Risks #2] or [Opp #1].
If the excerpts do not cover the user's question, say so plainly and recommend which document or section to
consult — do not invent details.

Be concise, structured, and use markdown. End with a "Next steps" bullet list when relevant.`;


const TOOL_SCHEMA = {
  name: "answer",
  description: "Final answer with citations",
  parameters: {
    type: "object",
    properties: {
      reply: { type: "string", description: "Markdown answer to the user." },
      citations: {
        type: "array",
        items: {
          type: "object",
          properties: {
            label: { type: "string" },
            kind: { type: "string", enum: ["risk", "opportunity", "requirement", "document", "question", "report", "other"] },
            ref_id: { type: "string" },
          },
          required: ["label"],
        },
      },
      suggested_followups: { type: "array", items: { type: "string" } },
    },
    required: ["reply"],
  },
};

async function buildContext(supa: ReturnType<typeof createClient>, solicitationId: string) {
  const [{ data: sol }, { data: risks }, { data: opps }, { data: reqs }, { data: qs }, { data: docs }, { data: gaps }] = await Promise.all([
    supa.from("solicitations").select("title,solicitation_number,issuing_agency,proposal_due_date,current_phase,ai_summary,incumbent_name,client_id").eq("id", solicitationId).maybeSingle(),
    supa.from("risks").select("id,title,description,severity,mitigation_strategy,is_mitigated,source_citation").eq("solicitation_id", solicitationId).limit(40),
    supa.from("opportunities").select("id,title,description,opportunity_type,impact_score,recommended_approach,client_capability_match").eq("solicitation_id", solicitationId).limit(40),
    supa.from("requirement_items").select("id,title,section_id,requirement_type,is_critical").eq("solicitation_id", solicitationId).limit(80),

    supa.from("strategic_questions").select("id,question_text,answer_text,category").eq("solicitation_id", solicitationId).limit(40),
    supa.from("documents").select("id,file_name,document_type").eq("solicitation_id", solicitationId).is("deleted_at", null).limit(20),
    supa.from("capability_gaps").select("id,requirement_summary,client_match_summary,severity").eq("solicitation_id", solicitationId).limit(40),
  ]);

  let clientProfile: any = null;
  if (sol?.client_id) {
    const { data } = await supa.from("client_profiles").select("*").eq("client_id", sol.client_id).maybeSingle();
    clientProfile = data;
  }

  return { sol, risks: risks ?? [], opps: opps ?? [], reqs: reqs ?? [], qs: qs ?? [], docs: docs ?? [], gaps: gaps ?? [], clientProfile };
}

function contextToString(ctx: Awaited<ReturnType<typeof buildContext>>): string {
  const s = ctx.sol;
  const parts: string[] = [];
  parts.push(`# Solicitation
Title: ${s?.title}
Number: ${s?.solicitation_number ?? "—"}
Agency: ${s?.issuing_agency ?? "—"}
Phase: ${s?.current_phase}
Due: ${s?.proposal_due_date ?? "—"}
Incumbent: ${s?.incumbent_name ?? "—"}
Summary: ${s?.ai_summary ?? "—"}`);

  parts.push(`# Documents (${ctx.docs.length})\n${ctx.docs.map((d: any) => `- [${d.document_type}] ${d.file_name}`).join("\n")}`);

  parts.push(`# Risks (${ctx.risks.length})\n${ctx.risks.map((r: any, i: number) =>
    `${i + 1}. [${r.severity}${r.is_mitigated ? "/mitigated" : ""}] ${r.title} — ${r.description?.slice(0, 240) ?? ""}${r.mitigation_strategy ? ` | Plan: ${r.mitigation_strategy.slice(0, 200)}` : ""}`
  ).join("\n")}`);

  parts.push(`# Opportunities (${ctx.opps.length})\n${ctx.opps.map((o: any, i: number) =>
    `${i + 1}. (impact ${o.impact_score ?? "?"}) ${o.title} — ${o.description?.slice(0, 200) ?? ""}${o.recommended_approach ? ` | Approach: ${o.recommended_approach.slice(0, 180)}` : ""}`
  ).join("\n")}`);

  parts.push(`# Requirements (${ctx.reqs.length})\n${ctx.reqs.slice(0, 60).map((r: any, i: number) => `${i + 1}. [${r.requirement_type}${r.is_critical ? "/critical" : ""}] ${r.title}`).join("\n")}`);

  parts.push(`# Capability gaps (${ctx.gaps.length})\n${ctx.gaps.map((g: any) => `- [${g.severity}] ${g.requirement_summary?.slice(0, 160)} → ${g.client_match_summary?.slice(0, 160) ?? "—"}`).join("\n")}`);

  parts.push(`# Strategic questions (${ctx.qs.length})\n${ctx.qs.slice(0, 20).map((q: any) => `Q: ${q.question_text?.slice(0, 200)}${q.answer_text ? `\n A: ${q.answer_text.slice(0, 200)}` : ""}`).join("\n")}`);

  if (ctx.clientProfile) {
    parts.push(`# Client profile\n${JSON.stringify({
      name: ctx.clientProfile.legal_name,
      core_capabilities: ctx.clientProfile.core_capabilities,
      certifications: ctx.clientProfile.certifications,
      naics_codes: ctx.clientProfile.naics_codes,
    }).slice(0, 2000)}`);
  }

  return parts.join("\n\n").slice(0, 60000);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization") ?? "";
    const token = authHeader.replace("Bearer ", "");
    const userClient = createClient(SUPABASE_URL, Deno.env.get("SUPABASE_ANON_KEY") ?? "", { global: { headers: { Authorization: authHeader } } });
    const { data: { user } } = await userClient.auth.getUser(token);
    if (!user) return new Response(JSON.stringify({ error: "unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    const { solicitationId, threadId, message } = await req.json();
    if (!solicitationId || !threadId || !message) {
      return new Response(JSON.stringify({ error: "solicitationId, threadId, and message are required" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const supa = createClient(SUPABASE_URL, SERVICE_KEY);

    // Verify the user can access this thread (RLS-style check via userClient)
    const { data: thread } = await userClient.from("assistant_threads").select("id,solicitation_id").eq("id", threadId).maybeSingle();
    if (!thread || thread.solicitation_id !== solicitationId) {
      return new Response(JSON.stringify({ error: "thread not found or access denied" }), { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Persist user message
    await supa.from("assistant_messages").insert({
      thread_id: threadId,
      role: "user",
      parts: [{ type: "text", text: message }],
      created_by: user.id,
    });

    // Load recent history
    const { data: history } = await supa.from("assistant_messages").select("role,parts").eq("thread_id", threadId).order("created_at", { ascending: true }).limit(30);

    // Build context
    const ctx = await buildContext(supa, solicitationId);
    const ctxStr = contextToString(ctx);

    const conversation = (history ?? []).map((m: any) => {
      const text = (m.parts ?? []).map((p: any) => (p.type === "text" ? p.text : "")).join("\n");
      return `${m.role.toUpperCase()}: ${text}`;
    }).join("\n\n");

    const userPrompt = `## Context for this solicitation\n\n${ctxStr}\n\n## Conversation so far\n\n${conversation}\n\n## Respond to the latest user message above.`;

    let result;
    try {
      result = await callAiTool({
        functionName: "solicitation-assistant",
        system: SYSTEM_PROMPT,
        user: userPrompt,
        tool: TOOL_SCHEMA,
      });
    } catch (err) {
      return aiErrorResponse(err, corsHeaders);
    }

    const reply = String(result.reply ?? "");
    const citations = Array.isArray(result.citations) ? result.citations : [];
    const followups = Array.isArray(result.suggested_followups) ? result.suggested_followups : [];

    const { data: assistantMsg } = await supa.from("assistant_messages").insert({
      thread_id: threadId,
      role: "assistant",
      parts: [{ type: "text", text: reply }],
      citations,
    }).select().single();

    // Update thread last_message_at + auto-title if first user message
    const updates: Record<string, unknown> = { last_message_at: new Date().toISOString() };
    const { data: t } = await supa.from("assistant_threads").select("title").eq("id", threadId).maybeSingle();
    if (t && t.title === "New chat") {
      updates.title = message.slice(0, 60).trim() || "New chat";
    }
    await supa.from("assistant_threads").update(updates).eq("id", threadId);

    return new Response(JSON.stringify({ message: assistantMsg, citations, followups }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("[solicitation-assistant] error", err);
    return aiErrorResponse(err, corsHeaders);
  }
});
