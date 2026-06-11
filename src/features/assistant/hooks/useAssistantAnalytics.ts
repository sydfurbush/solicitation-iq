import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { estimateCost } from "../lib/aiCost";

export type AuditRow = {
  id: string;
  user_id: string | null;
  persona: string | null;
  model: string | null;
  tokens_in: number | null;
  tokens_out: number | null;
  latency_ms: number | null;
  status: string;
  error: string | null;
  created_at: string;
};

export type ModelUsage = {
  model: string;
  requests: number;
  tokens: number;
  costUsd: number;
  unknownPricing: boolean;
};

export type AnalyticsSummary = {
  totalRequests: number;
  errors: number;
  errorRate: number;
  avgLatencyMs: number;
  totalTokensIn: number;
  totalTokensOut: number;
  estimatedCostUsd: number;
  hasUnknownPricing: boolean;
  byDay: Array<{ day: string; requests: number; errors: number; tokens: number }>;
  byPersona: Array<{ persona: string; count: number }>;
  byUser: Array<{ user_id: string; label: string; count: number }>;
  byModel: ModelUsage[];
  firstAuditedAt: string | null;
  scope: "org" | "solicitation";
};

export function useAssistantAnalytics(
  daysOrOpts: number | { days?: number; solicitationId?: string } = 30,
) {
  const opts =
    typeof daysOrOpts === "number" ? { days: daysOrOpts } : daysOrOpts;
  const solicitationId = opts.solicitationId;
  const days = opts.days ?? 30;
  const scope: "org" | "solicitation" = solicitationId ? "solicitation" : "org";

  return useQuery({
    queryKey: ["assistant_analytics", scope, solicitationId ?? null, days],
    staleTime: 60_000,
    queryFn: async (): Promise<AnalyticsSummary> => {
      let query = supabase
        .from("assistant_audit_log")
        .select("id,user_id,persona,model,tokens_in,tokens_out,latency_ms,status,error,created_at")
        .order("created_at", { ascending: true })
        .limit(5000);

      if (solicitationId) {
        query = query.eq("solicitation_id", solicitationId);
      } else {
        const since = new Date(Date.now() - days * 86400_000).toISOString();
        query = query.gte("created_at", since);
      }

      const { data: rows, error } = await query;
      if (error) throw error;
      const list = (rows ?? []) as AuditRow[];

      // Resolve user names
      const userIds = Array.from(new Set(list.map((r) => r.user_id).filter(Boolean))) as string[];
      const labelByUser = new Map<string, string>();
      if (userIds.length) {
        const { data: users } = await supabase
          .from("users")
          .select("id, full_name, email")
          .in("id", userIds);
        for (const u of users ?? []) {
          labelByUser.set(u.id as string, (u as any).full_name || (u as any).email || (u.id as string).slice(0, 8));
        }
      }

      const errors = list.filter((r) => r.status !== "ok").length;
      const latencies = list.map((r) => r.latency_ms ?? 0).filter((n) => n > 0);
      const avgLatencyMs = latencies.length
        ? Math.round(latencies.reduce((a, b) => a + b, 0) / latencies.length)
        : 0;
      const totalTokensIn = list.reduce((a, r) => a + (r.tokens_in ?? 0), 0);
      const totalTokensOut = list.reduce((a, r) => a + (r.tokens_out ?? 0), 0);

      // Per-row cost + per-model aggregation
      let estimatedCostUsd = 0;
      let hasUnknownPricing = false;
      const modelMap = new Map<string, ModelUsage>();
      for (const r of list) {
        const tin = r.tokens_in ?? 0;
        const tout = r.tokens_out ?? 0;
        const { usd, unknownPricing } = estimateCost({ model: r.model, tokensIn: tin, tokensOut: tout });
        estimatedCostUsd += usd;
        if (unknownPricing && (tin > 0 || tout > 0)) hasUnknownPricing = true;
        const key = r.model || "unknown";
        const cur = modelMap.get(key) ?? {
          model: key,
          requests: 0,
          tokens: 0,
          costUsd: 0,
          unknownPricing: false,
        };
        cur.requests += 1;
        cur.tokens += tin + tout;
        cur.costUsd += usd;
        if (unknownPricing && (tin > 0 || tout > 0)) cur.unknownPricing = true;
        modelMap.set(key, cur);
      }
      const byModel = Array.from(modelMap.values()).sort((a, b) => b.requests - a.requests);

      // By day
      const dayMap = new Map<string, { requests: number; errors: number; tokens: number }>();
      if (scope === "org") {
        for (let i = 0; i < days; i++) {
          const d = new Date(Date.now() - i * 86400_000).toISOString().slice(0, 10);
          dayMap.set(d, { requests: 0, errors: 0, tokens: 0 });
        }
      }
      for (const r of list) {
        const d = r.created_at.slice(0, 10);
        const cur = dayMap.get(d) ?? { requests: 0, errors: 0, tokens: 0 };
        cur.requests += 1;
        if (r.status !== "ok") cur.errors += 1;
        cur.tokens += (r.tokens_in ?? 0) + (r.tokens_out ?? 0);
        dayMap.set(d, cur);
      }
      const byDay = Array.from(dayMap.entries())
        .map(([day, v]) => ({ day, ...v }))
        .sort((a, b) => a.day.localeCompare(b.day));

      const personaMap = new Map<string, number>();
      for (const r of list) personaMap.set(r.persona ?? "unknown", (personaMap.get(r.persona ?? "unknown") ?? 0) + 1);
      const byPersona = Array.from(personaMap.entries())
        .map(([persona, count]) => ({ persona, count }))
        .sort((a, b) => b.count - a.count);

      const userMap = new Map<string, number>();
      for (const r of list) {
        if (!r.user_id) continue;
        userMap.set(r.user_id, (userMap.get(r.user_id) ?? 0) + 1);
      }
      const byUser = Array.from(userMap.entries())
        .map(([user_id, count]) => ({ user_id, label: labelByUser.get(user_id) ?? user_id.slice(0, 8), count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 10);

      return {
        totalRequests: list.length,
        errors,
        errorRate: list.length ? errors / list.length : 0,
        avgLatencyMs,
        totalTokensIn,
        totalTokensOut,
        estimatedCostUsd,
        hasUnknownPricing,
        byDay,
        byPersona,
        byUser,
        byModel,
        firstAuditedAt: list[0]?.created_at ?? null,
        scope,
      };
    },
  });
}
