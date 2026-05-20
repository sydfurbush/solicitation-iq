import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";

export type FormatProfile = Database["public"]["Tables"]["buyer_format_profiles"]["Row"];
export type FormatProfileInsert = Database["public"]["Tables"]["buyer_format_profiles"]["Insert"];
export type FormatProfileUpdate = Database["public"]["Tables"]["buyer_format_profiles"]["Update"];

const KEY = ["format-profiles"] as const;

export function useFormatProfiles() {
  return useQuery({
    queryKey: KEY,
    queryFn: async (): Promise<FormatProfile[]> => {
      const { data, error } = await supabase
        .from("buyer_format_profiles")
        .select("*")
        .order("vertical")
        .order("name");
      if (error) throw error;
      return data ?? [];
    },
  });
}

async function getOrgId(): Promise<string> {
  const { data: u } = await supabase.auth.getUser();
  const { data, error } = await supabase
    .from("users")
    .select("organization_id")
    .eq("id", u.user!.id)
    .maybeSingle();
  if (error) throw error;
  if (!data?.organization_id) throw new Error("No organization");
  return data.organization_id;
}

export function useCreateFormatProfile() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (patch: Partial<FormatProfileInsert> & { name: string }) => {
      const organization_id = await getOrgId();
      if (patch.is_default) {
        await supabase
          .from("buyer_format_profiles")
          .update({ is_default: false })
          .eq("organization_id", organization_id)
          .eq("vertical", patch.vertical ?? "federal")
          .eq("is_default", true);
      }
      const { data, error } = await supabase
        .from("buyer_format_profiles")
        .insert({ ...patch, organization_id })
        .select("*")
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY }),
  });
}

export function useUpdateFormatProfile() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, patch }: { id: string; patch: FormatProfileUpdate }) => {
      if (patch.is_default) {
        const { data: existing } = await supabase
          .from("buyer_format_profiles")
          .select("organization_id, vertical")
          .eq("id", id)
          .single();
        if (existing) {
          await supabase
            .from("buyer_format_profiles")
            .update({ is_default: false })
            .eq("organization_id", existing.organization_id)
            .eq("vertical", patch.vertical ?? existing.vertical)
            .eq("is_default", true)
            .neq("id", id);
        }
      }
      const { data, error } = await supabase
        .from("buyer_format_profiles")
        .update(patch)
        .eq("id", id)
        .select("*")
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY }),
  });
}

export function useDeleteFormatProfile() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { data: uses } = await supabase
        .from("solicitations")
        .select("id, title")
        .eq("format_profile_id", id)
        .limit(5);
      if (uses && uses.length > 0) {
        throw new Error(
          `In use by ${uses.length} solicitation(s): ${uses.map((u) => u.title).join(", ")}`,
        );
      }
      const { error } = await supabase.from("buyer_format_profiles").delete().eq("id", id);
      if (error) throw error;
      return id;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY }),
  });
}
