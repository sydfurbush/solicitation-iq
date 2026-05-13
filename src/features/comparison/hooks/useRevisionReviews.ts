import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuthContext } from "@/features/auth/components/AuthProvider";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const sb = supabase as any;

const key = (solicitationId: string, userId: string | undefined) =>
  ["revision-reviews", solicitationId, userId ?? "anon"] as const;

/** Returns Set of revision IDs the current user has marked reviewed. */
export function useRevisionReviews(solicitationId: string | undefined) {
  const { user } = useAuthContext();
  const userId = user?.id;
  return useQuery({
    queryKey: solicitationId ? key(solicitationId, userId) : ["revision-reviews", "none"],
    enabled: !!solicitationId && !!userId,
    queryFn: async () => {
      const { data: revs, error: revErr } = await sb
        .from("solicitation_revisions")
        .select("id")
        .eq("solicitation_id", solicitationId);
      if (revErr) throw revErr;
      const ids = (revs ?? []).map((r: { id: string }) => r.id);
      if (ids.length === 0) return new Set<string>();
      const { data, error } = await sb
        .from("revision_reviews")
        .select("revision_id")
        .eq("user_id", userId)
        .in("revision_id", ids);
      if (error) throw error;
      return new Set<string>((data ?? []).map((r: { revision_id: string }) => r.revision_id));
    },
  });
}

export function useMarkRevisionReviewed(solicitationId: string | undefined) {
  const qc = useQueryClient();
  const { user } = useAuthContext();
  const userId = user?.id;
  return useMutation({
    mutationFn: async (revisionId: string) => {
      if (!userId) throw new Error("Not signed in");
      const { error } = await sb
        .from("revision_reviews")
        .upsert({ revision_id: revisionId, user_id: userId }, { onConflict: "revision_id,user_id" });
      if (error) throw error;
    },
    onSuccess: () => {
      if (solicitationId) qc.invalidateQueries({ queryKey: key(solicitationId, userId) });
    },
  });
}

export function useUnmarkRevisionReviewed(solicitationId: string | undefined) {
  const qc = useQueryClient();
  const { user } = useAuthContext();
  const userId = user?.id;
  return useMutation({
    mutationFn: async (revisionId: string) => {
      if (!userId) throw new Error("Not signed in");
      const { error } = await sb
        .from("revision_reviews")
        .delete()
        .eq("revision_id", revisionId)
        .eq("user_id", userId);
      if (error) throw error;
    },
    onSuccess: () => {
      if (solicitationId) qc.invalidateQueries({ queryKey: key(solicitationId, userId) });
    },
  });
}
