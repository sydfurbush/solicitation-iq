import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuthContext } from "@/features/auth/components/AuthProvider";

export type SamKeyStatus = {
  hasKey: boolean;
  lastFour: string | null;
  updatedAt: string | null;
};

export function useSamKey() {
  const { user } = useAuthContext();
  const qc = useQueryClient();

  const query = useQuery<SamKeyStatus>({
    queryKey: ["integration", "sam_gov", user?.id],
    enabled: !!user?.id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("user_integrations" as never)
        .select("last_four, updated_at")
        .eq("user_id", user!.id)
        .eq("provider", "sam_gov")
        .maybeSingle();
      if (error) throw error;
      const row = data as { last_four: string | null; updated_at: string | null } | null;
      return {
        hasKey: !!row,
        lastFour: row?.last_four ?? null,
        updatedAt: row?.updated_at ?? null,
      };
    },
  });

  const save = useMutation({
    mutationFn: async (apiKey: string) => {
      const trimmed = apiKey.trim();
      if (!trimmed) throw new Error("API key is required");
      if (!user?.id) throw new Error("Not signed in");
      const { error } = await supabase.from("user_integrations" as never).upsert(
        {
          user_id: user.id,
          provider: "sam_gov",
          api_key: trimmed,
        } as never,
        { onConflict: "user_id,provider" },
      );
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["integration", "sam_gov"] }),
  });

  const remove = useMutation({
    mutationFn: async () => {
      if (!user?.id) throw new Error("Not signed in");
      const { error } = await supabase
        .from("user_integrations" as never)
        .delete()
        .eq("user_id", user.id)
        .eq("provider", "sam_gov");
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["integration", "sam_gov"] }),
  });

  return { ...query, save, remove };
}
