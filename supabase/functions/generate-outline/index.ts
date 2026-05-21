import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { callAiTool, aiErrorResponse } from "../_shared/aiClient.ts";
import { getTeamingPromptBlock } from "../_shared/teaming.ts";
import { buildClientLens } from "../_shared/clientLens.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const SYSTEM_PROMPT = `You build a proposal outline for a federal RFP response.

Inputs:
- Section L (Instructions to Offerors) — defines required volumes, sections, format, page limits
- Section M (Evaluation Factors) — defines what gets scored and how
- Requirements Traceability Matrix — every shall statement

Produce a hierarchical outline:
- Top level: Volumes (e.g. Volume I — Technical, Volume II — Past Performance, Volume III — Price)
- Second level: Sections within each volume mapped to Section L instructions
- Third level: Subsections aligned to evaluation factors and grouped requirements

For each node:
- title: clear descriptive title
- volume: volume name (top-level only or repeated)
- section_number: e.g. "1.0", "1.1", "1.1.2"
- page_allocation: integer page budget if Section L provides one or you can allocate
- source_l_reference: short citation back to Section L (e.g. "L.5.2(a)")
- source_section_refs: comma-separated [ref:N] ids from the SECTION L/M EXCERPTS block above that you used to construct this node (so reviewers can verify)
- linked_requirement_refs: comma-separated req_number values from the RTM that this node covers

Be comprehensive but concise. Typical proposal outline = 30-80 nodes.

Return ONLY structured output via the tool call.`;

const SCHEMA = {
  name: "generate_outline",
  description: "Hierarchical proposal outline",
  parameters: {
    type: "object",
    properties: {
      title: { type: "string" },
      nodes: {
        type: "array",
        items: {
          type: "object",
          properties: {
            sort_order: { type: "number" },
            depth: { type: "number", description: "0=volume, 1=section, 2=subsection, 3=sub-subsection" },
            title: { type: "string" },
            volume: { type: "string" },
            section_number: { type: "string" },
            page_allocation: { type: "number" },
            source_l_reference: { type: "string" },
            source_section_refs: { type: "string", description: "Comma-separated [ref:N] ids from the SECTION L/M EXCERPTS that support this node, e.g. '1,3,7'" },
            linked_requirement_refs: { type: "string" },
          },
          required: ["title", "depth", "sort_order"],
        },
      },
    },
    required: ["nodes"],
  },
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const { solicitationId } = await req.json();
    if (!solicitationId) {
      return new Response(JSON.stringify({ error: "solicitationId required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const supabase = createClient(SUPABASE_URL, SERVICE_KEY);

    const { data: sol } = await supabase
      .from("solicitations")
      .select("title, ai_summary, client_id, lens_overrides")
      .eq("id", solicitationId)
      .maybeSingle();

    const { data: requirements } = await supabase
      .from("requirement_items")
      .select("id, req_number, shall_text, source_section")
      .eq("solicitation_id", solicitationId);

    const { data: sectionAnalyses } = await supabase
      .from("section_analyses")
      .select("section_code, section_title, summary, scoring_weight")
      .eq("solicitation_id", solicitationId);

    const { data: documents } = await supabase
      .from("documents")
      .select("id, file_name")
      .eq("solicitation_id", solicitationId)
      .is("deleted_at", null);

    const docIds = (documents ?? []).map((d) => d.id);
    const { data: lmSections } = docIds.length
      ? await supabase
          .from("document_sections")
          .select("document_id, section_number, section_title, content, page_start")
          .in("document_id", docIds)
          .or("section_number.ilike.L%,section_number.ilike.M%,section_title.ilike.%instructions%,section_title.ilike.%evaluation%")
          .limit(40)
      : { data: [] };

    // Tag each section with a stable [ref:N] id so the AI can cite back
    const lmRefs = (lmSections ?? []).map((s, i) => ({
      ref: i + 1,
      document_id: (s as any).document_id ?? null,
      section_number: s.section_number ?? null,
      section_title: s.section_title ?? null,
      page_start: s.page_start ?? null,
      content: s.content,
    }));
    const docNameById = new Map((documents ?? []).map((d) => [d.id, d.file_name] as const));
    const lmText = lmRefs
      .map((s) => `[ref:${s.ref}] [${s.section_number ?? "?"} ${s.section_title ?? ""} | doc=${docNameById.get(s.document_id ?? "") ?? "?"} p.${s.page_start ?? "?"}]\n${(s.content ?? "").slice(0, 4000)}`)
      .join("\n\n");

    const reqText = (requirements ?? []).slice(0, 200).map((r) =>
      `${r.req_number} [${r.source_section ?? "?"}] ${r.shall_text.slice(0, 240)}`
    ).join("\n");

    const sectionsText = (sectionAnalyses ?? []).map((s) =>
      `${s.section_code}${s.section_title ? ` — ${s.section_title}` : ""}${s.scoring_weight ? ` (weight=${s.scoring_weight})` : ""}\n${s.summary}`
    ).join("\n\n");

    const teamingBlock = await getTeamingPromptBlock(solicitationId);
    const userPrompt = `Solicitation: ${sol?.title ?? "Untitled"}\n\n${teamingBlock ? teamingBlock + "\n\n" : ""}SECTION L/M EXCERPTS:\n${lmText || "(none found)"}\n\nSECTION ANALYSES:\n${sectionsText || "(none)"}\n\nREQUIREMENTS:\n${reqText || "(none)"}\n\nBuild the proposal outline.`;

    console.log(`[generate-outline] sol=${solicitationId} reqs=${requirements?.length ?? 0}`);

    const lens = await buildClientLens(sol?.client_id ?? null, { topic: "outline", query: `${(sol as any)?.title ?? ""} ${(sol as any)?.issuing_agency ?? ""} ${(((sol as any)?.ai_summary ?? "") + "").slice(0, 600)}`, override: (sol?.lens_overrides as Record<string, unknown> | null) ?? null });
    const parsed = await callAiTool({
      functionName: "generate-outline",
      system: lens.promptBlock ? `${lens.promptBlock}\n\n${SYSTEM_PROMPT}` : SYSTEM_PROMPT,
      user: userPrompt,
      tool: SCHEMA,
    }) as { title?: string; nodes: Array<Record<string, unknown>> };

    const nodes = parsed.nodes ?? [];

    // Deactivate prior outlines
    await supabase
      .from("proposal_outlines")
      .update({ is_active: false })
      .eq("solicitation_id", solicitationId);

    // Get next version
    const { data: prior } = await supabase
      .from("proposal_outlines")
      .select("version")
      .eq("solicitation_id", solicitationId)
      .order("version", { ascending: false })
      .limit(1)
      .maybeSingle();
    const nextVersion = (prior?.version ?? 0) + 1;

    const { data: outline, error: outErr } = await supabase
      .from("proposal_outlines")
      .insert({
        solicitation_id: solicitationId,
        title: parsed.title ?? `Proposal Outline v${nextVersion}`,
        version: nextVersion,
        is_active: true,
      })
      .select()
      .single();
    if (outErr) throw outErr;

    // Build req_number → id map for linking
    const reqByNumber = new Map<string, string>();
    (requirements ?? []).forEach((r) => reqByNumber.set(r.req_number, r.id));

    // Insert nodes in 2 passes so parent_id can be wired up by depth
    // For simplicity: flat insert with linear sort_order, no parent linking.
    const lmRefById = new Map(lmRefs.map((r) => [r.ref, r] as const));
    const rows = nodes.map((n, i) => {
      const refs = ((n.linked_requirement_refs as string) ?? "")
        .split(/[,;\s]+/)
        .map((s) => s.trim())
        .filter(Boolean)
        .map((num) => reqByNumber.get(num))
        .filter((v): v is string => !!v);
      const sectionRefs = ((n.source_section_refs as string) ?? "")
        .split(/[,;\s]+/)
        .map((s) => s.trim().replace(/^\[?ref:/i, "").replace(/\]$/, ""))
        .filter(Boolean)
        .map((s) => Number(s))
        .filter((v) => Number.isFinite(v))
        .map((ref) => lmRefById.get(ref))
        .filter((v): v is NonNullable<typeof v> => !!v)
        .map((s) => ({
          document_id: s.document_id,
          document_name: docNameById.get(s.document_id ?? "") ?? null,
          section_number: s.section_number,
          section_title: s.section_title,
          page_start: s.page_start,
        }));
      return {
        outline_id: outline.id,
        parent_id: null,
        sort_order: typeof n.sort_order === "number" ? n.sort_order : i,
        volume: (n.volume as string) ?? null,
        section_number: (n.section_number as string) ?? null,
        title: (n.title as string) ?? "Untitled",
        page_allocation: n.page_allocation ? Number(n.page_allocation) : null,
        source_l_reference: (n.source_l_reference as string) ?? null,
        linked_requirement_ids: refs,
        source_document_sections: sectionRefs,
      };
    });

    if (rows.length) {
      const { error } = await supabase.from("outline_nodes").insert(rows);
      if (error) throw error;
    }

    return new Response(JSON.stringify({ success: true, outline_id: outline.id, inserted: rows.length }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("[generate-outline] error", e);
    return aiErrorResponse(e, corsHeaders);
  }
});
