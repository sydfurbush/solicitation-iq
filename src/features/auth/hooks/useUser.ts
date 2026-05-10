import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuthContext } from "../components/AuthProvider";
import type { Database } from "@/integrations/supabase/types";

type AppRole = Database["public"]["Enums"]["app_role"];

export function useUser() {
  const { user: authUser, isLoading: authLoading } = useAuthContext();

  const query = useQuery({
    queryKey: ["user-profile", authUser?.id],
    enabled: !!authUser?.id,
    queryFn: async () => {
      const { data: profile, error } = await supabase
        .from("users")
        .select("*, organization:organizations(*)")
        .eq("id", authUser!.id)
        .maybeSingle();
      if (error) throw error;

      const { data: roles } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", authUser!.id);

      return {
        profile,
        organization: profile?.organization ?? null,
        role: (roles?.[0]?.role ?? null) as AppRole | null,
      };
    },
  });

  return {
    user: query.data?.profile ?? null,
    organization: query.data?.organization ?? null,
    role: query.data?.role ?? null,
    isLoading: authLoading || query.isLoading,
    refetch: query.refetch,
  };
}
