import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";

export type ClientGap = Database["public"]["Tables"]["capability_gaps"]["Row"] & {
  sent_to_client?: boolean | null;
  sent_to_client_at?: string | null;
  client_response?: string | null;
  client_responded_at?: string | null;
  client_confirmed?: boolean | null;
};

const key = (id: string) => ["client-gaps", id] as const;

export function useClientGaps(solicitationId: string | undefined) {
  return useQuery({
    queryKey: solicitationId ? key(solicitationId) : ["client-gaps", "none"],
    enabled: !!solicitationId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("capability_gaps")
        .select("*")
        .eq("solicitation_id", solicitationId!)
        .eq("sent_to_client", true)
        .order("severity", { ascending: false });
      if (error) throw error;
      return (data ?? []) as ClientGap[];
    },
  });
}

export function useUpdateClientGap(solicitationId: string | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      id: string;
      client_confirmed: boolean | null;
      client_response: string | null;
    }) => {
      const { error } = await supabase
        .from("capability_gaps")
        .update({
          client_confirmed: input.client_confirmed,
          client_response: input.client_response,
          client_responded_at: new Date().toISOString(),
        } as any)
        .eq("id", input.id);
      if (error) throw error;
    },
    onSuccess: () => {
      if (solicitationId) qc.invalidateQueries({ queryKey: key(solicitationId) });
    },
  });
}
