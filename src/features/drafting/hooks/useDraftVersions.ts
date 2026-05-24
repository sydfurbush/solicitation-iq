import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

/**
 * Returns a map of draft_id -> ISO timestamp of the most recent AI snapshot
 * (rows in proposal_draft_versions whose change_summary starts with "Pre-").
 * Used by deriveDraftStatus to detect human edits after AI runs.
 */
export function useDraftAiSnapshots(solicitationId: string | undefined) {
  return useQuery({
    queryKey: ["proposal-draft-versions", solicitationId ?? "none"],
    enabled: !!solicitationId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("proposal_draft_versions")
        .select("draft_id, change_summary, created_at")
        .eq("solicitation_id", solicitationId!)
        .order("created_at", { ascending: false });
      if (error) throw error;
      const map = new Map<string, string>();
      for (const r of (data ?? []) as Array<{ draft_id: string; change_summary: string | null; created_at: string }>) {
        if (!r.change_summary || !r.change_summary.startsWith("Pre-")) continue;
        if (!map.has(r.draft_id)) map.set(r.draft_id, r.created_at);
      }
      return map;
    },
  });
}
