import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { callAiTool, aiErrorResponse } from "../_shared/aiClient.ts";
import { getTeamingPromptBlock } from "../_shared/teaming.ts";
import { buildClientLens } from "../_shared/clientLens.ts";
import {
  buildReqIndex,
  resolveRequirementRefs,
  findUnplacedRequirements,
  buildRequirementPromptList,
} from "../_shared/requirementLinks.ts";

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
- section_number: DECIMAL ONLY — e.g. "1.0", "1.1", "1.1.2", "2.0", "2.1". NEVER use Roman numerals (I, II, III) or letter prefixes (A, B, L, M). Top-level volumes are "1.0", "2.0", "3.0".
- page_allocation: integer page budget if Section L provides one or you can allocate
- source_l_reference: short citation back to Section L (e.g. "L.5.2(a)")
- source_section_refs: comma-separated [ref:N] ids from the SECTION L/M EXCERPTS block above that you used to construct this node (so reviewers can verify)
- linked_requirement_refs: comma-separated req_number values from the RTM that this node covers. Copy each req_number EXACTLY as written in the RTM list.

REQUIREMENT COVERAGE (mandatory):
- EVERY requirement in the RTM list must appear in linked_requirement_refs of at least one node. Broad or umbrella requirements (e.g. "deliver services IAW the contract") go in the most relevant compliance or management-approach section. Do not skip short, minor or administrative requirements.
- Before returning, check the RTM list line by line and place any requirement you have not yet assigned.

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
      .select("title, ai_summary, client_id, lens_overrides, format_profile_id")
      .eq("id", solicitationId)
      .maybeSingle();

    let volumePageLimits: Record<string, number | null> = {};
    if (sol?.format_profile_id) {
      const { data: fp } = await supabase
        .from("buyer_format_profiles")
        .select("volume_page_limits")
        .eq("id", sol.format_profile_id)
        .maybeSingle();
      if (fp?.volume_page_limits && typeof fp.volume_page_limits === "object") {
        volumePageLimits = fp.volume_page_limits as Record<string, number | null>;
      }
    }


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

    // Every requirement is listed (the old version dropped everything after 200).
    const reqText = buildRequirementPromptList(requirements ?? []);

    const sectionsText = (sectionAnalyses ?? []).map((s) =>
      `${s.section_code}${s.section_title ? ` — ${s.section_title}` : ""}${s.scoring_weight ? ` (weight=${s.scoring_weight})` : ""}\n${s.summary}`
    ).join("\n\n");

    const teamingBlock = await getTeamingPromptBlock(solicitationId);
    const limitsBlock = Object.keys(volumePageLimits).length
      ? `VOLUME PAGE LIMITS (the per-section page_allocation values for each volume MUST sum to its limit):\n${Object.entries(volumePageLimits).map(([v, n]) => `- ${v}: ${n ?? "no limit"}`).join("\n")}\n\n`
      : "";
    const userPrompt = `Solicitation: ${sol?.title ?? "Untitled"}\n\n${teamingBlock ? teamingBlock + "\n\n" : ""}${limitsBlock}SECTION L/M EXCERPTS:\n${lmText || "(none found)"}\n\nSECTION ANALYSES:\n${sectionsText || "(none)"}\n\nREQUIREMENTS:\n${reqText || "(none)"}\n\nBuild the proposal outline.`;


    console.log(`[generate-outline] sol=${solicitationId} reqs=${requirements?.length ?? 0}`);

    const lens = await buildClientLens(sol?.client_id ?? null, { topic: "outline", query: `${(sol as any)?.title ?? ""} ${(sol as any)?.issuing_agency ?? ""} ${(((sol as any)?.ai_summary ?? "") + "").slice(0, 600)}`, override: (sol?.lens_overrides as Record<string, unknown> | null) ?? null });
    const parsed = await callAiTool({
      functionName: "generate-outline",
      system: lens.promptBlock ? `${lens.promptBlock}\n\n${SYSTEM_PROMPT}` : SYSTEM_PROMPT,
      user: userPrompt,
      tool: SCHEMA,
    }) as { title?: string; nodes: Array<Record<string, unknown>> };

    // Some models (notably Claude) occasionally return the array as a JSON string.
    let rawNodes: unknown = parsed.nodes ?? [];
    if (typeof rawNodes === "string") {
      try {
        rawNodes = JSON.parse(rawNodes);
      } catch {
        throw new Error("AI returned a malformed outline (nodes was an unparseable string). Please retry.");
      }
    }
    if (!Array.isArray(rawNodes)) {
      throw new Error("AI returned an outline in an unexpected shape. Please retry.");
    }
    const nodes = (rawNodes as unknown[]).filter(
      (n): n is Record<string, unknown> => !!n && typeof n === "object" && !Array.isArray(n),
    );
    if (nodes.length === 0) throw new Error("AI returned an empty outline. Please retry.");

    // Deterministic decimal renumbering — ALWAYS overrides whatever the AI returned
    // (Roman numerals like "I.1", letter prefixes like "L.5", or anything else)
    const counters = [0, 0, 0, 0];
    // Depth = number of dots in the AI's section_number (e.g. "I"=0, "I.1"=1, "II.2.3"=2).
    // This is more reliable than trusting n.depth, which the model often omits or fudges.
    const inferDepth = (sn: string | undefined, fallback: unknown): number => {
      if (typeof sn === "string" && sn.trim()) {
        return Math.max(0, Math.min(3, (sn.match(/\./g) ?? []).length));
      }
      if (typeof fallback === "number") return Math.max(0, Math.min(3, fallback));
      return 0;
    };
    for (const n of nodes) {
      let d = inferDepth(n.section_number as string | undefined, n.depth);
      // A child can never appear before any parent has been emitted.
      if (d > 0 && counters[0] === 0) d = 0;
      counters[d] += 1;
      for (let i = d + 1; i < counters.length; i++) counters[i] = 0;
      let sn: string;
      if (d === 0) sn = `${counters[0]}.0`;
      else if (d === 1) sn = `${counters[0]}.${counters[1]}`;
      else if (d === 2) sn = `${counters[0]}.${counters[1]}.${counters[2]}`;
      else sn = `${counters[0]}.${counters[1]}.${counters[2]}.${counters[3]}`;
      n.section_number = sn;
      n.depth = d;
    }
    console.log(`[generate-outline] renumbered first 5:`, nodes.slice(0, 5).map((n) => n.section_number));

    // Scale per-section page_allocation values to match volume page limits, if a profile is set
    if (Object.keys(volumePageLimits).length) {
      const byVolume = new Map<string, Array<Record<string, unknown>>>();
      for (const n of nodes) {
        if ((n.depth as number) === 0) continue; // skip volume rows themselves
        const v = (n.volume as string) ?? "";
        if (!byVolume.has(v)) byVolume.set(v, []);
        byVolume.get(v)!.push(n);
      }
      for (const [vol, group] of byVolume.entries()) {
        const limit = volumePageLimits[vol];
        if (typeof limit !== "number" || limit <= 0) continue;
        const total = group.reduce((s, n) => s + (Number(n.page_allocation) || 0), 0);
        if (total <= 0) {
          const even = Math.max(1, Math.floor(limit / group.length));
          for (const n of group) n.page_allocation = even;
        } else if (Math.abs(total - limit) > 1) {
          const scale = limit / total;
          for (const n of group) {
            const v = Math.max(1, Math.round((Number(n.page_allocation) || 0) * scale));
            n.page_allocation = v;
          }
        }
        const newTotal = group.reduce((s, n) => s + (Number(n.page_allocation) || 0), 0);
        console.log(`[generate-outline] volume "${vol}" limit=${limit} scaled total=${newTotal}`);
      }
    }




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
    // Matching tolerates "C.1.1" vs "C-1.1", case and brackets.
    const reqIndex = buildReqIndex(requirements ?? []);
    const unmatchedRefs: string[] = [];

    // Insert nodes in 2 passes so parent_id can be wired up by depth
    // For simplicity: flat insert with linear sort_order, no parent linking.
    const lmRefById = new Map(lmRefs.map((r) => [r.ref, r] as const));
    const rows = nodes.map((n, i) => {
      const resolved = resolveRequirementRefs(n.linked_requirement_refs as string, reqIndex);
      unmatchedRefs.push(...resolved.unmatched);
      const refs = resolved.ids;
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

    // Report requirements the outline did not place, so the UI can flag them
    // instead of them silently showing up as "Gap" in the compliance matrix.
    const unplaced = findUnplacedRequirements(requirements ?? [], rows.map((r) => r.linked_requirement_ids));
    if (unplaced.length || unmatchedRefs.length) {
      console.warn(
        `[generate-outline] sol=${solicitationId} unplaced=${unplaced.length} unmatchedRefs=${unmatchedRefs.length}`,
        unplaced.map((r) => r.req_number).slice(0, 50),
        unmatchedRefs.slice(0, 50),
      );
    }

    return new Response(JSON.stringify({
      success: true,
      outline_id: outline.id,
      inserted: rows.length,
      total_requirements: requirements?.length ?? 0,
      unplaced_requirements: unplaced.map((r) => ({ id: r.id, req_number: r.req_number, source_section: r.source_section, shall_text: r.shall_text })),
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("[generate-outline] error", e);
    return aiErrorResponse(e, corsHeaders);
  }
});
