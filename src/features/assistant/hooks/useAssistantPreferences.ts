import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { PersonaKey } from "../lib/personas";

export type AssistantPreferences = {
  user_id: string;
  tone: string;
  voice_replies: boolean;
  auto_learn: boolean;
  blocked_topics: string[];
  default_persona: PersonaKey;
  plain_mode_default: boolean;
  updated_at: string;
};

const DEFAULTS: Omit<AssistantPreferences, "user_id" | "updated_at"> = {
  tone: "neutral",
  voice_replies: false,
  auto_learn: true,
  blocked_topics: [],
  default_persona: "capture_manager",
  plain_mode_default: false,
};

export function useAssistantPreferences() {
  return useQuery({
    queryKey: ["assistant_preferences"],
    queryFn: async () => {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user?.id) return null;
      const { data, error } = await supabase
        .from("assistant_preferences")
        .select("*")
        .eq("user_id", u.user.id)
        .maybeSingle();
      if (error) throw error;
      if (!data) return { user_id: u.user.id, updated_at: new Date().toISOString(), ...DEFAULTS } as AssistantPreferences;
      return data as unknown as AssistantPreferences;
    },
  });
}

export function useUpdateAssistantPreferences() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (patch: Partial<Omit<AssistantPreferences, "user_id" | "updated_at">>) => {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user?.id) throw new Error("Not signed in");
      const { data, error } = await supabase
        .from("assistant_preferences")
        .upsert({ user_id: u.user.id, ...patch }, { onConflict: "user_id" })
        .select()
        .single();
      if (error) throw error;
      return data as unknown as AssistantPreferences;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["assistant_preferences"] }),
  });
}
