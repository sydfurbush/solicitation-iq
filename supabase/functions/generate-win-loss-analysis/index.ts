import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { callAiTool } from "../_shared/aiClient.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;

const SCHEMA = {
  name: "win_loss_analysis",
  description: "Structured win/loss analysis content",
  parameters: {
    type: "object",
    properties: {
      summary: { type: "string", description: "1-2 paragraph overall executive summary of the win/loss picture across the period." },
      win_patterns: {
        type: "array",
        description: "Recurring themes that drive wins.",
        items: { type: "object", properties: { theme: { type: "string" }, detail: { type: "string" } } },
      },
      loss_patterns: {
        type: "array",
        description: "Recurring themes that drive losses.",
        items: { type: "object", properties: { theme: { type: "string" }, detail: { type: "string" } } },
      },
      no_bid_rationale: {
        type: "array",
        description: "Reasons we chose to no-bid.",
        items: { type: "object", properties: { theme: { type: "string" }, detail: { type: "string" } } },
      },
      recommendations: {
        type: "array",
        description: "3-6 concrete recommendations to improve win rate, drawn from the data.",
        items: { type: "string" },
      },
    },
    required: ["summary", "recommendations"],
  },
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const body = await req.json().catch(() => ({}));
    const clientId: string | null = body.clientId ?? null;
    const from: string | null = body.from ?? null;
    const to: string | null = body.to ?? null;

    const auth = req.headers.get("Authorization");
    if (!auth) {
      return new Response(JSON.stringify({ error: "Not authenticated" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const userClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: auth } },
    });
    const { data: userRes } = await userClient.auth.getUser();
    if (!userRes.user) {
      return new Response(JSON.stringify({ error: "Not authenticated" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Use service role for the data query (RLS would require per-solicitation membership which is brittle for org-wide).
    const svc = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Look up org for the authenticated user
    const { data: profile } = await svc
      .from("users")
      .select("organization_id")
      .eq("id", userRes.user.id)
      .maybeSingle();
    const orgId = profile?.organization_id;
    if (!orgId) {
      return new Response(JSON.stringify({ error: "No organization" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let q = svc
      .from("solicitation_outcomes")
      .select(
        "outcome, awarded_value, awarded_at, notes, solicitation:solicitations!inner(id, title, issuing_agency, contract_type, ai_summary, evaluation_factors, client_id, clients!inner(name, organization_id))"
      )
      .neq("outcome", "pending")
      .eq("solicitation.clients.organization_id", orgId)
      .limit(200);
    if (clientId) q = q.eq("solicitation.client_id", clientId);
    if (from) q = q.gte("awarded_at", from);
    if (to) q = q.lte("awarded_at", to);

    const { data: rows, error } = await q;
    if (error) throw error;
    const outcomes = rows ?? [];

    if (outcomes.length === 0) {
      return new Response(
        JSON.stringify({
          summary: "No decided outcomes recorded for the selected period.",
          win_patterns: [],
          loss_patterns: [],
          no_bid_rationale: [],
          recommendations: [],
          counts: { won: 0, lost: 0, no_bid: 0, withdrawn: 0 },
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const counts = { won: 0, lost: 0, no_bid: 0, withdrawn: 0 } as Record<string, number>;
    for (const r of outcomes) counts[(r as { outcome: string }).outcome] = (counts[(r as { outcome: string }).outcome] ?? 0) + 1;

    const userPrompt = `You are analyzing win/loss patterns across an organization's proposal portfolio.

PERIOD: ${from ?? "all-time"} to ${to ?? "today"}
CLIENT FILTER: ${clientId ?? "all clients"}

OUTCOME COUNTS: ${JSON.stringify(counts)}

OUTCOMES DATA (raw):
${JSON.stringify(outcomes, null, 2).slice(0, 25000)}

Identify durable themes — not one-off anecdotes. For each theme give a short label and 1-2 sentence detail referencing specific solicitations by title when useful. Recommendations should be concrete and actionable.`;

    const parsed = (await callAiTool({
      functionName: "generate-win-loss-analysis",
      system:
        "You are a capture-strategy analyst. Produce a structured win/loss analysis from the supplied outcomes data. Focus on patterns visible in the data; do not invent facts.",
      user: userPrompt,
      tool: SCHEMA,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    })) as Record<string, any>;

    return new Response(
      JSON.stringify({
        summary: parsed.summary ?? "",
        win_patterns: parsed.win_patterns ?? [],
        loss_patterns: parsed.loss_patterns ?? [],
        no_bid_rationale: parsed.no_bid_rationale ?? [],
        recommendations: parsed.recommendations ?? [],
        counts,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    console.error("[generate-win-loss-analysis] error", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : String(e) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
