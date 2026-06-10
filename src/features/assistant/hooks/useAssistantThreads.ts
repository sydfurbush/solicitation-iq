import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type AssistantThread = {
  id: string;
  solicitation_id: string;
  title: string;
  pinned: boolean;
  last_message_at: string;
  created_at: string;
  created_by: string | null;
};

export type AssistantMessage = {
  id: string;
  thread_id: string;
  role: "user" | "assistant" | "system";
  parts: Array<{ type: string; text?: string }>;
  citations: Array<{ label: string; kind?: string; ref_id?: string }>;
  created_at: string;
};

export function useAssistantThreads(solicitationId: string | undefined) {
  return useQuery({
    queryKey: ["assistant_threads", solicitationId],
    enabled: !!solicitationId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("assistant_threads")
        .select("*")
        .eq("solicitation_id", solicitationId!)
        .order("pinned", { ascending: false })
        .order("last_message_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as AssistantThread[];
    },
  });
}

export function useAssistantMessages(threadId: string | undefined) {
  return useQuery({
    queryKey: ["assistant_messages", threadId],
    enabled: !!threadId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("assistant_messages")
        .select("*")
        .eq("thread_id", threadId!)
        .order("created_at", { ascending: true });
      if (error) throw error;
      return (data ?? []) as unknown as AssistantMessage[];
    },
  });
}

export function useCreateThread() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ solicitationId, title }: { solicitationId: string; title?: string }) => {
      const { data: u } = await supabase.auth.getUser();
      const { data, error } = await supabase
        .from("assistant_threads")
        .insert({ solicitation_id: solicitationId, title: title ?? "New chat", created_by: u.user?.id })
        .select()
        .single();
      if (error) throw error;
      return data as AssistantThread;
    },
    onSuccess: (t) => qc.invalidateQueries({ queryKey: ["assistant_threads", t.solicitation_id] }),
  });
}

export function useUpdateThread() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, patch }: { id: string; patch: Partial<Pick<AssistantThread, "title" | "pinned">> }) => {
      const { data, error } = await supabase.from("assistant_threads").update(patch).eq("id", id).select().single();
      if (error) throw error;
      return data as AssistantThread;
    },
    onSuccess: (t) => qc.invalidateQueries({ queryKey: ["assistant_threads", t.solicitation_id] }),
  });
}

export function useDeleteThread() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, solicitationId }: { id: string; solicitationId: string }) => {
      const { error } = await supabase.from("assistant_threads").delete().eq("id", id);
      if (error) throw error;
      return { id, solicitationId };
    },
    onSuccess: ({ solicitationId }) => qc.invalidateQueries({ queryKey: ["assistant_threads", solicitationId] }),
  });
}

export function useSendAssistantMessage() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      solicitationId,
      threadId,
      message,
    }: {
      solicitationId: string;
      threadId: string;
      message: string;
    }) => {
      const { data, error } = await supabase.functions.invoke("solicitation-assistant", {
        body: { solicitationId, threadId, message },
      });
      if (error) throw error;
      return data as { message: AssistantMessage; citations: any[]; followups: string[] };
    },
    onSuccess: (_d, vars) => {
      qc.invalidateQueries({ queryKey: ["assistant_messages", vars.threadId] });
      qc.invalidateQueries({ queryKey: ["assistant_threads", vars.solicitationId] });
    },
  });
}

export function useAssistantPresets() {
  return useQuery({
    queryKey: ["assistant_presets"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("assistant_presets")
        .select("*")
        .order("sort_order", { ascending: true });
      if (error) throw error;
      return data ?? [];
    },
  });
}
