import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

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

export type AnalyticsSummary = {
  totalRequests: number;
  errors: number;
  errorRate: number;
  avgLatencyMs: number;
  totalTokensIn: number;
  totalTokensOut: number;
  byDay: Array<{ day: string; requests: number; errors: number; tokens: number }>;
  byPersona: Array<{ persona: string; count: number }>;
  byUser: Array<{ user_id: string; label: string; count: number }>;
};

export function useAssistantAnalytics(days: number = 30) {
  return useQuery({
    queryKey: ["assistant_analytics", days],
    staleTime: 60_000,
    queryFn: async (): Promise<AnalyticsSummary> => {
      const since = new Date(Date.now() - days * 86400_000).toISOString();
      const { data: rows, error } = await supabase
        .from("assistant_audit_log")
        .select("id,user_id,persona,model,tokens_in,tokens_out,latency_ms,status,error,created_at")
        .gte("created_at", since)
        .order("created_at", { ascending: true })
        .limit(5000);
      if (error) throw error;
      const list = (rows ?? []) as AuditRow[];

      // Resolve user names (best effort, only ids we see)
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

      const dayMap = new Map<string, { requests: number; errors: number; tokens: number }>();
      // Pre-seed with all days in range so the chart is continuous.
      for (let i = 0; i < days; i++) {
        const d = new Date(Date.now() - i * 86400_000).toISOString().slice(0, 10);
        dayMap.set(d, { requests: 0, errors: 0, tokens: 0 });
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
        byDay,
        byPersona,
        byUser,
      };
    },
  });
}
