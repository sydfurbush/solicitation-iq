import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuthContext } from "@/features/auth/components/AuthProvider";

export function useClientUser() {
  const { user, isLoading: authLoading } = useAuthContext();

  const query = useQuery({
    queryKey: ["client-user", user?.id],
    enabled: !!user?.id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("client_users")
        .select("*, client:clients(*)")
        .eq("id", user!.id)
        .is("deleted_at", null)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  return {
    clientUser: query.data ?? null,
    client: (query.data as any)?.client ?? null,
    isClient: !!query.data,
    isLoading: authLoading || query.isLoading,
    refetch: query.refetch,
  };
}
