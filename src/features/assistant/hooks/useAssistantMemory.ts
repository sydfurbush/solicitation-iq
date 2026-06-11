import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type AssistantMemoryRow = {
  id: string;
  user_id: string;
  organization_id: string | null;
  fact: string;
  source: "explicit" | "auto";
  created_at: string;
  updated_at: string;
};

export function useAssistantMemory() {
  return useQuery({
    queryKey: ["assistant_memory"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("assistant_memory")
        .select("*")
        .order("updated_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as unknown as AssistantMemoryRow[];
    },
  });
}

export function useAddMemory() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ fact, source = "explicit" }: { fact: string; source?: "explicit" | "auto" }) => {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user?.id) throw new Error("Not signed in");
      const { data: userRow } = await supabase
        .from("users")
        .select("organization_id")
        .eq("id", u.user.id)
        .maybeSingle();
      const { data, error } = await supabase
        .from("assistant_memory")
        .insert({
          user_id: u.user.id,
          organization_id: userRow?.organization_id ?? null,
          fact: fact.trim(),
          source,
        })
        .select()
        .single();
      if (error) throw error;
      return data as unknown as AssistantMemoryRow;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["assistant_memory"] }),
  });
}

export function useDeleteMemory() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id }: { id: string }) => {
      const { error } = await supabase.from("assistant_memory").delete().eq("id", id);
      if (error) throw error;
      return { id };
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["assistant_memory"] }),
  });
}
