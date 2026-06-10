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

const STOPWORDS = new Set([
  "the","a","an","and","or","but","if","then","else","for","of","to","in","on","at","by","with","from","as","is","are","was","were","be","been","being","it","its","this","that","these","those","i","you","we","they","he","she","them","our","your","their","my","me","us","do","does","did","done","have","has","had","will","would","should","could","can","may","might","must","not","no","so","than","into","about","over","under","what","which","who","whom","whose","when","where","why","how","please","tell","show","give","provide","need","want","know","find","summary","summarize","explain","describe","help","also","any","all","some","more","most","other","such","only","own","same","just","like","get","got","make","made","use","used","using","yes","ok","okay"
]);

type DocExcerpt = {
  document_id: string;
  document_name: string;
  section_id: string | null;
  section_title: string | null;
  page_number: number | null;
  snippet: string;
  rank: number;
  label: string;
};

type DocCitation = {
  kind: "document";
  label: string;
  ref_id: string;
  document_id: string;
  section_id: string | null;
  page: number | null;
};

function buildSearchTerms(message: string): string[] {
  const trimmed = (message ?? "").trim();
  if (!trimmed) return [];
  const terms: string[] = [];
  // Full message as one query (best for FTS phrase rank)
  terms.push(trimmed.slice(0, 200));
  // Top tokens after stopword removal
  const tokens = trimmed
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, " ")
    .split(/\s+/)
    .filter((t) => t.length >= 3 && !STOPWORDS.has(t));
  // Dedupe preserving order
  const seen = new Set<string>();
  const keywords: string[] = [];
  for (const t of tokens) {
    if (!seen.has(t)) { seen.add(t); keywords.push(t); }
    if (keywords.length >= 6) break;
  }
  if (keywords.length) terms.push(keywords.slice(0, 6).join(" "));
  return Array.from(new Set(terms)).slice(0, 3);
}

async function retrieveDocumentExcerpts(
  supa: ReturnType<typeof createClient>,
  solicitationId: string,
  message: string,
): Promise<{ block: string; citations: DocCitation[] }> {
  const queries = buildSearchTerms(message);
  if (!queries.length) return { block: "", citations: [] };

  const all: DocExcerpt[] = [];
  for (const q of queries) {
    const { data, error } = await supa.rpc("search_document_content", {
      p_solicitation_id: solicitationId,
      p_search_term: q,
    });
    if (error) {
      console.warn("[solicitation-assistant] search_document_content failed:", error.message);
      continue;
    }
    for (const r of (data ?? []) as any[]) {
      const sectionLabel = r.section_title ? `§${String(r.section_title).slice(0, 60)} ` : "";
      const pageLabel = r.page_number ? `p.${r.page_number}` : "";
      const label = `Doc: ${r.document_name}${sectionLabel || pageLabel ? ` ${sectionLabel}${pageLabel}`.trim() : ""}`.trim();
      all.push({
        document_id: r.document_id,
        document_name: r.document_name,
        section_id: r.section_id ?? null,
        section_title: r.section_title ?? null,
        page_number: r.page_number ?? null,
        snippet: String(r.snippet ?? "").replace(/<\/?mark>/g, ""),
        rank: Number(r.rank ?? 0),
        label,
      });
    }
  }

  // Dedupe by section_id (fallback to document_id + snippet), keep best rank
  const bestByKey = new Map<string, DocExcerpt>();
  for (const ex of all) {
    const key = ex.section_id ?? `${ex.document_id}:${ex.snippet.slice(0, 40)}`;
    const prev = bestByKey.get(key);
    if (!prev || ex.rank > prev.rank) bestByKey.set(key, ex);
  }
  const sorted = Array.from(bestByKey.values()).sort((a, b) => b.rank - a.rank).slice(0, 8);

  const MAX_CHARS = 12000;
  const lines: string[] = [];
  const citations: DocCitation[] = [];
  let used = 0;
  for (const ex of sorted) {
    const entry = `[${ex.label}]\n${ex.snippet.trim()}`;
    if (used + entry.length > MAX_CHARS) break;
    lines.push(entry);
    used += entry.length + 2;
    citations.push({
      kind: "document",
      label: `[${ex.label}]`,
      ref_id: ex.section_id ?? ex.document_id,
      document_id: ex.document_id,
      section_id: ex.section_id,
      page: ex.page_number,
    });
  }

  if (!lines.length) return { block: "", citations: [] };
  const block = `# Document excerpts (${lines.length} of ${all.length} matches)\nThese are verbatim passages from the uploaded solicitation documents. Use these as primary evidence and cite with the bracketed label.\n\n${lines.join("\n\n")}`;
  return { block, citations };
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

    // Build structured context + retrieve verbatim document excerpts via FTS
    const [ctx, excerpts] = await Promise.all([
      buildContext(supa, solicitationId),
      retrieveDocumentExcerpts(supa, solicitationId, message),
    ]);
    const ctxStr = contextToString(ctx);

    const conversation = (history ?? []).map((m: any) => {
      const text = (m.parts ?? []).map((p: any) => (p.type === "text" ? p.text : "")).join("\n");
      return `${m.role.toUpperCase()}: ${text}`;
    }).join("\n\n");

    const excerptBlock = excerpts.block ? `${excerpts.block}\n\n` : "";
    const userPrompt = `## Context for this solicitation\n\n${excerptBlock}${ctxStr}\n\n## Conversation so far\n\n${conversation}\n\n## Respond to the latest user message above.`;

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
    const modelCitations = Array.isArray(result.citations) ? result.citations : [];
    const followups = Array.isArray(result.suggested_followups) ? result.suggested_followups : [];

    // Merge retrieved document citations with model-emitted ones, dedupe by label
    const mergedCitations = [...modelCitations];
    const seenLabels = new Set(modelCitations.map((c: any) => String(c?.label ?? "")));
    for (const c of excerpts.citations) {
      if (!seenLabels.has(c.label)) {
        mergedCitations.push(c);
        seenLabels.add(c.label);
      }
    }

    const { data: assistantMsg } = await supa.from("assistant_messages").insert({
      thread_id: threadId,
      role: "assistant",
      parts: [{ type: "text", text: reply }],
      citations: mergedCitations,
    }).select().single();


    // Update thread last_message_at + auto-title if first user message
    const updates: Record<string, unknown> = { last_message_at: new Date().toISOString() };
    const { data: t } = await supa.from("assistant_threads").select("title").eq("id", threadId).maybeSingle();
    if (t && t.title === "New chat") {
      updates.title = message.slice(0, 60).trim() || "New chat";
    }
    await supa.from("assistant_threads").update(updates).eq("id", threadId);

    return new Response(JSON.stringify({ message: assistantMsg, citations: mergedCitations, followups }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("[solicitation-assistant] error", err);
    return aiErrorResponse(err, corsHeaders);
  }
});
