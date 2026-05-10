import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useClientUser } from "./useClientUser";

export function useClientSolicitations() {
  const { client, isClient } = useClientUser();
  return useQuery({
    queryKey: ["portal-solicitations", client?.id],
    enabled: isClient && !!client?.id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("solicitations")
        .select("*")
        .eq("client_id", client!.id)
        .is("deleted_at", null)
        .order("updated_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });
}

export function useClientSolicitation(solicitationId?: string) {
  const { isClient } = useClientUser();
  return useQuery({
    queryKey: ["portal-solicitation", solicitationId],
    enabled: isClient && !!solicitationId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("solicitations")
        .select("*, client:clients(*)")
        .eq("id", solicitationId!)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });
}

export function useClientReports(solicitationId?: string) {
  const { isClient } = useClientUser();
  return useQuery({
    queryKey: ["portal-reports", solicitationId],
    enabled: isClient && !!solicitationId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("executive_reports")
        .select("*")
        .eq("solicitation_id", solicitationId!)
        .eq("client_accessible", true)
        .eq("is_published", true)
        .order("generated_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });
}

export function useAllClientReports() {
  const { client, isClient } = useClientUser();
  return useQuery({
    queryKey: ["portal-reports-all", client?.id],
    enabled: isClient && !!client?.id,
    queryFn: async () => {
      const { data: sols } = await supabase
        .from("solicitations")
        .select("id, title")
        .eq("client_id", client!.id);
      const ids = (sols ?? []).map((s) => s.id);
      if (!ids.length) return [];
      const { data, error } = await supabase
        .from("executive_reports")
        .select("*, solicitation:solicitations(id,title)")
        .in("solicitation_id", ids)
        .eq("client_accessible", true)
        .eq("is_published", true)
        .order("generated_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });
}
