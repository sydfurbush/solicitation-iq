import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export function useAssistantStarters(opts: {
  solicitationId: string;
  persona: string;
  plainMode: boolean;
  enabled?: boolean;
}) {
  const { solicitationId, persona, plainMode, enabled = true } = opts;
  return useQuery({
    queryKey: ["assistant_starters", solicitationId, persona, plainMode],
    enabled: enabled && !!solicitationId,
    staleTime: 5 * 60 * 1000,
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke("generate-assistant-starters", {
        body: { solicitationId, persona, plainMode },
      });
      if (error) throw error;
      const starters = Array.isArray(data?.starters) ? (data.starters as string[]) : [];
      return starters;
    },
  });
}
