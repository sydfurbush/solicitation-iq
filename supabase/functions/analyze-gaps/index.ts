import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { callAiTool, aiErrorResponse } from "../_shared/aiClient.ts";
import { buildClientLens } from "../_shared/clientLens.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const SYSTEM_PROMPT = `You identify gaps between a federal solicitation's requirements and a contractor's stated capabilities.

Use the provided requirements list (already extracted) and the client capability summary. Produce a CONCISE list of meaningful gaps only — do NOT echo every requirement. Group by gap_type and order by severity.

For each gap:
- title: 4-10 word label
- description: 1-3 sentences explaining the gap and why it matters
- gap_type: one of capability | past_performance | certification | teaming | other
- severity: low | medium | high | critical (critical = potential no-bid trigger)
- recommendation: one of build | buy | team | no_bid | accept
- requirement_ref: the req_number(s) this gap relates to (comma-separated if multiple)

Return ONLY structured output via the tool call.`;

const SCHEMA = {
  name: "analyze_gaps",
  description: "Capability gap analysis",
  parameters: {
    type: "object",
    properties: {
      gaps: {
        type: "array",
        items: {
          type: "object",
          properties: {
            title: { type: "string" },
            description: { type: "string" },
            gap_type: { type: "string", enum: ["capability", "past_performance", "certification", "teaming", "other"] },
            severity: { type: "string", enum: ["low", "medium", "high", "critical"] },
            recommendation: { type: "string", enum: ["build", "buy", "team", "no_bid", "accept"] },
            requirement_ref: { type: "string" },
          },
          required: ["title", "description", "gap_type", "severity"],
        },
      },
    },
    required: ["gaps"],
  },
};

function formatCapabilities(caps: unknown): string {
  if (!caps) return "(no capabilities profile on file — flag this as a critical gap)";
  if (typeof caps === "string") return caps;
  if (typeof caps !== "object") return String(caps);
  const c = caps as Record<string, unknown>;
  const lines: string[] = [];
  const arr = (k: string) => Array.isArray(c[k]) ? (c[k] as unknown[]).map(String).filter(Boolean) : [];
  const str = (k: string) => typeof c[k] === "string" ? (c[k] as string).trim() : "";
  if (str("core_capabilities")) lines.push(`Core capabilities:\n${str("core_capabilities")}`);
  if (str("differentiators")) lines.push(`Differentiators:\n${str("differentiators")}`);
  const naics = arr("naics_codes"); if (naics.length) lines.push(`NAICS codes: ${naics.join(", ")}`);
  const certs = arr("certifications"); if (certs.length) lines.push(`Certifications & set-asides: ${certs.join(", ")}`);
  if (str("past_performance")) lines.push(`Past performance:\n${str("past_performance")}`);
  if (str("key_personnel")) lines.push(`Key personnel:\n${str("key_personnel")}`);
  if (str("teaming_partners")) lines.push(`Teaming partners:\n${str("teaming_partners")}`);
  if (str("notes")) lines.push(`Additional notes:\n${str("notes")}`);
  return lines.length ? lines.join("\n\n") : "(profile present but empty)";
}

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

    const { data: client } = sol?.client_id
      ? await supabase.from("clients").select("name, industry, notes, metadata").eq("id", sol.client_id).maybeSingle()
      : { data: null };

    const { data: requirements } = await supabase
      .from("requirement_items")
      .select("req_number, shall_text, source_section")
      .eq("solicitation_id", solicitationId)
      .order("req_number", { ascending: true });

    if (!requirements || requirements.length === 0) {
      return new Response(JSON.stringify({ error: "No requirements found. Run RTM extraction first." }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const reqText = requirements.slice(0, 250).map((r) =>
      `${r.req_number} [${r.source_section ?? "?"}] ${r.shall_text.slice(0, 280)}`
    ).join("\n");

    const capabilities = (client?.metadata as Record<string, unknown> | null)?.capabilities ?? null;
    const capText = formatCapabilities(capabilities);
    const clientText = client
      ? `CLIENT: ${client.name}\nINDUSTRY: ${client.industry ?? "n/a"}\nNOTES: ${client.notes ?? "n/a"}\n\nCAPABILITIES PROFILE:\n${capText}`
      : "(no client profile)";

    const userPrompt = `Solicitation: ${sol?.title ?? "Untitled"}\n\n${clientText}\n\nREQUIREMENTS:\n${reqText}\n\nIdentify gaps.`;

    const lens = await buildClientLens(sol?.client_id ?? null, { topic: "gaps", query: `${(sol as any)?.title ?? ""} ${(sol as any)?.issuing_agency ?? ""} ${(((sol as any)?.ai_summary ?? "") + "").slice(0, 600)}`, override: (sol?.lens_overrides as Record<string, unknown> | null) ?? null });
    const parsed = await callAiTool({
      functionName: "analyze-gaps",
      system: lens.promptBlock ? `${lens.promptBlock}\n\n${SYSTEM_PROMPT}` : SYSTEM_PROMPT,
      user: userPrompt,
      tool: SCHEMA,
    }) as { gaps: Array<Record<string, unknown>> };

    await supabase
      .from("capability_gaps")
      .delete()
      .eq("solicitation_id", solicitationId)
      .eq("is_ai_generated", true);

    const rows = (parsed.gaps ?? []).map((g) => ({
      solicitation_id: solicitationId,
      title: (g.title as string) ?? "Gap",
      description: (g.description as string) ?? null,
      gap_type: (g.gap_type as string) ?? "capability",
      severity: (g.severity as string) ?? "medium",
      recommendation: (g.recommendation as string) ?? null,
      client_note: g.requirement_ref ? `Requirements: ${g.requirement_ref}` : null,
      is_ai_generated: true,
    }));

    if (rows.length) {
      const { error } = await supabase.from("capability_gaps").insert(rows);
      if (error) throw error;
    }

    return new Response(JSON.stringify({ success: true, inserted: rows.length }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("[analyze-gaps] error", e);
    return aiErrorResponse(e, corsHeaders);
  }
});
