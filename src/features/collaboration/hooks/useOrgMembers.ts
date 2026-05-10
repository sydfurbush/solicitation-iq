import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface OrgMember {
  id: string;
  full_name: string | null;
  email: string;
  avatar_url: string | null;
}

export function useOrgMembers() {
  return useQuery({
    queryKey: ["org-members"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("users")
        .select("id, full_name, email, avatar_url")
        .is("deleted_at", null);
      if (error) throw error;
      return (data ?? []) as OrgMember[];
    },
    staleTime: 5 * 60 * 1000,
  });
}

export function useMembersMap() {
  const q = useOrgMembers();
  const map = new Map<string, OrgMember>();
  (q.data ?? []).forEach((m) => map.set(m.id, m));
  return { ...q, map };
}
