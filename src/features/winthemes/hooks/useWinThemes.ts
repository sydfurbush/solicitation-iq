import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";

export type WinTheme = Database["public"]["Tables"]["win_themes"]["Row"];
export type WinThemeUpdate = Database["public"]["Tables"]["win_themes"]["Update"];

const key = (id: string) => ["win-themes", id] as const;

export function useWinThemes(solicitationId: string | undefined) {
  return useQuery({
    queryKey: solicitationId ? key(solicitationId) : ["win-themes", "none"],
    enabled: !!solicitationId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("win_themes")
        .select("*")
        .eq("solicitation_id", solicitationId!)
        .order("created_at", { ascending: true });
      if (error) throw error;
      return (data ?? []) as WinTheme[];
    },
  });
}

export function useGenerateWinThemes(solicitationId: string | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      if (!solicitationId) throw new Error("Missing solicitationId");
      const { data, error } = await supabase.functions.invoke("generate-win-themes", {
        body: { solicitationId },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      return data;
    },
    onSuccess: () => {
      if (!solicitationId) return;
      qc.invalidateQueries({ queryKey: key(solicitationId) });
    },
  });
}

export function useUpdateWinTheme(solicitationId: string | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { id: string; patch: WinThemeUpdate }) => {
      const { error } = await supabase.from("win_themes").update(input.patch).eq("id", input.id);
      if (error) throw error;
    },
    onSuccess: () => {
      if (!solicitationId) return;
      qc.invalidateQueries({ queryKey: key(solicitationId) });
    },
  });
}

export function useDeleteWinTheme(solicitationId: string | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("win_themes").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      if (!solicitationId) return;
      qc.invalidateQueries({ queryKey: key(solicitationId) });
    },
  });
}
