import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";

export type ClientProfile = Database["public"]["Tables"]["client_profiles"]["Row"];
export type ClientProfileUpdate = Database["public"]["Tables"]["client_profiles"]["Update"];
export type ClientProfileInsert = Database["public"]["Tables"]["client_profiles"]["Insert"];

export function useClientProfile(clientId?: string) {
  return useQuery({
    queryKey: ["client-profile", clientId],
    enabled: !!clientId,
    queryFn: async (): Promise<ClientProfile | null> => {
      const { data, error } = await supabase
        .from("client_profiles")
        .select("*")
        .eq("client_id", clientId!)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });
}

export function useUpsertClientProfile(clientId?: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (patch: Partial<ClientProfileInsert>) => {
      if (!clientId) throw new Error("clientId required");
      const { data: existing } = await supabase
        .from("client_profiles")
        .select("id")
        .eq("client_id", clientId)
        .maybeSingle();

      if (existing) {
        const { data, error } = await supabase
          .from("client_profiles")
          .update(patch as ClientProfileUpdate)
          .eq("id", existing.id)
          .select("*")
          .single();
        if (error) throw error;
        return data;
      }

      const { data, error } = await supabase
        .from("client_profiles")
        .insert({ ...(patch as ClientProfileInsert), client_id: clientId })
        .select("*")
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["client-profile", clientId] });
    },
  });
}
