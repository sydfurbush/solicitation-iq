import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { FormatProfile } from "./useFormatProfiles";

/**
 * Returns the format profile applied to this solicitation, or the org default,
 * or null if none is configured.
 */
export function useFormatProfileForSolicitation(solicitationId: string | undefined) {
  return useQuery({
    queryKey: ["format-profile-for-solicitation", solicitationId],
    enabled: !!solicitationId,
    queryFn: async (): Promise<{ profile: FormatProfile | null; isDefault: boolean }> => {
      const { data: sol, error: solErr } = await supabase
        .from("solicitations")
        .select("format_profile_id, client_id, clients!inner(organization_id)")
        .eq("id", solicitationId!)
        .maybeSingle();
      if (solErr) throw solErr;

      if (sol?.format_profile_id) {
        const { data, error } = await supabase
          .from("buyer_format_profiles")
          .select("*")
          .eq("id", sol.format_profile_id)
          .maybeSingle();
        if (error) throw error;
        if (data) return { profile: data as FormatProfile, isDefault: false };
      }

      const orgId = (sol as { clients?: { organization_id?: string } } | null)?.clients?.organization_id;
      if (orgId) {
        const { data, error } = await supabase
          .from("buyer_format_profiles")
          .select("*")
          .eq("organization_id", orgId)
          .eq("is_default", true)
          .maybeSingle();
        if (error) throw error;
        if (data) return { profile: data as FormatProfile, isDefault: true };
      }
      return { profile: null, isDefault: false };
    },
  });
}
