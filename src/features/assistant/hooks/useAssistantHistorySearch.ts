import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type HistoryHit = {
  message_id: string;
  thread_id: string;
  thread_title: string;
  role: "user" | "assistant" | "system";
  snippet: string;
  created_at: string;
};

const SNIPPET_RADIUS = 80;

function buildSnippet(text: string, term: string): string {
  const i = text.toLowerCase().indexOf(term.toLowerCase());
  if (i < 0) return text.slice(0, SNIPPET_RADIUS * 2);
  const start = Math.max(0, i - SNIPPET_RADIUS);
  const end = Math.min(text.length, i + term.length + SNIPPET_RADIUS);
  return (start > 0 ? "…" : "") + text.slice(start, end) + (end < text.length ? "…" : "");
}

export function useAssistantHistorySearch(solicitationId: string, query: string) {
  const term = query.trim();
  return useQuery({
    queryKey: ["assistant_history_search", solicitationId, term],
    enabled: !!solicitationId && term.length >= 2,
    staleTime: 15_000,
    queryFn: async (): Promise<HistoryHit[]> => {
      const { data: threads, error: te } = await supabase
        .from("assistant_threads")
        .select("id, title")
        .eq("solicitation_id", solicitationId);
      if (te) throw te;
      const ids = (threads ?? []).map((t) => t.id);
      if (ids.length === 0) return [];
      const titleById = new Map((threads ?? []).map((t) => [t.id, t.title as string]));

      // Pull recent messages across all threads (capped) and filter client-side.
      const { data: msgs, error: me } = await supabase
        .from("assistant_messages")
        .select("id, thread_id, role, parts, created_at")
        .in("thread_id", ids)
        .order("created_at", { ascending: false })
        .limit(500);
      if (me) throw me;

      const needle = term.toLowerCase();
      const hits: HistoryHit[] = [];
      for (const m of msgs ?? []) {
        const parts = (m as any).parts as Array<{ type: string; text?: string }> | null;
        const text = (parts ?? []).map((p) => (p?.type === "text" ? p.text ?? "" : "")).join("\n");
        if (!text) continue;
        if (text.toLowerCase().includes(needle)) {
          hits.push({
            message_id: m.id as string,
            thread_id: m.thread_id as string,
            thread_title: titleById.get(m.thread_id as string) ?? "Untitled",
            role: (m as any).role,
            snippet: buildSnippet(text, term),
            created_at: m.created_at as string,
          });
        }
        if (hits.length >= 40) break;
      }
      return hits;
    },
  });
}
