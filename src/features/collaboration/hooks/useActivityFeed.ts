import { useEffect, useState } from "react";
import { useInfiniteQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface ActivityEvent {
  id: string;
  solicitation_id: string;
  user_id: string | null;
  event_type: string;
  event_description: string;
  entity_type: string | null;
  entity_id: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
}

const PAGE_SIZE = 25;

export function useActivityFeed(solicitationId: string | undefined) {
  const qc = useQueryClient();

  useEffect(() => {
    if (!solicitationId) return;
    const channel = supabase
      .channel(`activity-${solicitationId}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "activity_log", filter: `solicitation_id=eq.${solicitationId}` },
        () => {
          qc.invalidateQueries({ queryKey: ["activity", solicitationId] });
        }
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [solicitationId, qc]);

  return useInfiniteQuery({
    queryKey: ["activity", solicitationId],
    enabled: !!solicitationId,
    initialPageParam: 0,
    queryFn: async ({ pageParam = 0 }) => {
      const from = (pageParam as number) * PAGE_SIZE;
      const to = from + PAGE_SIZE - 1;
      const { data, error } = await supabase
        .from("activity_log" as never)
        .select("*")
        .eq("solicitation_id", solicitationId!)
        .order("created_at", { ascending: false })
        .range(from, to);
      if (error) throw error;
      return (data ?? []) as unknown as ActivityEvent[];
    },
    getNextPageParam: (last, pages) => (last.length === PAGE_SIZE ? pages.length : undefined),
  });
}

export function useActivityFilters() {
  const [eventType, setEventType] = useState<string>("all");
  const [userId, setUserId] = useState<string>("all");
  return { eventType, setEventType, userId, setUserId };
}
