import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type AssistantFolder = {
  id: string;
  user_id: string;
  organization_id: string | null;
  name: string;
  color: string | null;
  sort_order: number;
  created_at: string;
  updated_at: string;
};

export function useAssistantFolders() {
  return useQuery({
    queryKey: ["assistant_folders"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("assistant_folders" as any)
        .select("*")
        .order("sort_order", { ascending: true })
        .order("created_at", { ascending: true });
      if (error) throw error;
      return (data ?? []) as unknown as AssistantFolder[];
    },
  });
}

export function useCreateFolder() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ name, color }: { name: string; color?: string }) => {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user?.id) throw new Error("Not signed in");
      const { data: userRow } = await supabase
        .from("users")
        .select("organization_id")
        .eq("id", u.user.id)
        .maybeSingle();
      const { data, error } = await supabase
        .from("assistant_folders" as any)
        .insert({
          user_id: u.user.id,
          organization_id: userRow?.organization_id ?? null,
          name: name.trim(),
          color: color ?? null,
        })
        .select()
        .single();
      if (error) throw error;
      return data as unknown as AssistantFolder;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["assistant_folders"] }),
  });
}

export function useRenameFolder() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, name }: { id: string; name: string }) => {
      const { error } = await supabase
        .from("assistant_folders" as any)
        .update({ name: name.trim() })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["assistant_folders"] }),
  });
}

export function useDeleteFolder() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id }: { id: string }) => {
      const { error } = await supabase.from("assistant_folders" as any).delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["assistant_folders"] });
      qc.invalidateQueries({ queryKey: ["assistant_threads"] });
    },
  });
}
