import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { PersonaKey } from "../lib/personas";

export type PinnedEntityKind = "risk" | "opportunity" | "requirement" | "document";
export type PinnedEntity = { kind: PinnedEntityKind; id: string; label: string };
export type PinnedEntityPayload = { entities: PinnedEntity[] } | null;

export type AssistantThread = {
  id: string;
  solicitation_id: string;
  title: string;
  pinned: boolean;
  persona: PersonaKey;
  plain_mode: boolean;
  pinned_client_id: string | null;
  pinned_solicitation_id: string | null;
  pinned_entity: PinnedEntityPayload;
  pinned_knowledge_ids: string[];
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

export type SlashPayload = {
  handler: "remember" | "forget" | "summarize" | "cite" | "risks" | "requirements" | "clear";
  rest: string;
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
      return (data ?? []) as unknown as AssistantThread[];
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
      // Apply preferences defaults (best-effort)
      let defaultPersona: PersonaKey = "capture_manager";
      let plainDefault = false;
      if (u.user?.id) {
        const { data: prefs } = await supabase
          .from("assistant_preferences")
          .select("default_persona, plain_mode_default")
          .eq("user_id", u.user.id)
          .maybeSingle();
        if (prefs?.default_persona) defaultPersona = prefs.default_persona as PersonaKey;
        if (prefs?.plain_mode_default) plainDefault = !!prefs.plain_mode_default;
      }
      const { data, error } = await supabase
        .from("assistant_threads")
        .insert({
          solicitation_id: solicitationId,
          title: title ?? "New chat",
          created_by: u.user?.id,
          persona: defaultPersona,
          plain_mode: plainDefault,
        })
        .select()
        .single();
      if (error) throw error;
      return data as unknown as AssistantThread;
    },
    onSuccess: (t) => qc.invalidateQueries({ queryKey: ["assistant_threads", t.solicitation_id] }),
  });
}

export function useUpdateThread() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      id,
      patch,
    }: {
      id: string;
      patch: Partial<Pick<AssistantThread, "title" | "pinned" | "persona" | "plain_mode" | "pinned_knowledge_ids">>;
    }) => {
      const { data, error } = await supabase
        .from("assistant_threads")
        .update(patch)
        .eq("id", id)
        .select()
        .single();
      if (error) throw error;
      return data as unknown as AssistantThread;
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
      persona,
      plainMode,
      slash,
      pinnedKnowledgeIds,
      attachmentIds,
    }: {
      solicitationId: string;
      threadId: string;
      message: string;
      persona?: PersonaKey;
      plainMode?: boolean;
      slash?: SlashPayload | null;
      pinnedKnowledgeIds?: string[];
      attachmentIds?: string[];
    }) => {
      const { data, error } = await supabase.functions.invoke("solicitation-assistant", {
        body: {
          solicitationId,
          threadId,
          message,
          persona,
          plainMode,
          slash: slash ?? null,
          pinnedKnowledgeIds: pinnedKnowledgeIds ?? [],
          attachmentIds: attachmentIds ?? [],
        },
      });
      if (error) throw error;
      return data as { message: AssistantMessage; citations: any[]; followups: string[] };
    },
    onSuccess: (_d, vars) => {
      qc.invalidateQueries({ queryKey: ["assistant_messages", vars.threadId] });
      qc.invalidateQueries({ queryKey: ["assistant_threads", vars.solicitationId] });
      qc.invalidateQueries({ queryKey: ["assistant_attachments", vars.threadId] });
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
