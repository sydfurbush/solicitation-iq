import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";

export type KnowledgeDoc = Database["public"]["Tables"]["client_knowledge_documents"]["Row"];

const key = (clientId: string) => ["client-knowledge", clientId] as const;

export function useClientKnowledge(clientId?: string) {
  return useQuery({
    queryKey: clientId ? key(clientId) : ["client-knowledge", "none"],
    enabled: !!clientId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("client_knowledge_documents")
        .select("*")
        .eq("client_id", clientId!)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as KnowledgeDoc[];
    },
    refetchInterval: (q) => {
      const rows = (q.state.data as KnowledgeDoc[] | undefined) ?? [];
      return rows.some((r) => r.status === "pending" || r.status === "embedding") ? 2500 : false;
    },
  });
}

export function useCreateKnowledgeNote(clientId?: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { title: string; body: string; tags?: string[]; source_url?: string }) => {
      if (!clientId) throw new Error("clientId required");
      const { data: userResp } = await supabase.auth.getUser();
      const { data: doc, error } = await supabase
        .from("client_knowledge_documents")
        .insert({
          client_id: clientId,
          title: input.title.trim(),
          source_type: "note",
          raw_text: input.body,
          tags: input.tags ?? [],
          source_url: input.source_url ?? null,
          byte_size: input.body.length,
          status: "pending",
          created_by: userResp.user?.id ?? null,
        })
        .select()
        .single();
      if (error) throw error;
      const { error: invErr } = await supabase.functions.invoke("ingest-client-knowledge", {
        body: { documentId: doc.id },
      });
      if (invErr) throw invErr;
      return doc;
    },
    onSuccess: () => clientId && qc.invalidateQueries({ queryKey: key(clientId) }),
  });
}

export function useUploadKnowledgeFile(clientId?: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (file: File) => {
      if (!clientId) throw new Error("clientId required");
      const lower = file.name.toLowerCase();
      if (!lower.endsWith(".txt") && !lower.endsWith(".md")) {
        throw new Error("Only .txt and .md files are supported in this version. Paste longer documents as a note.");
      }
      const path = `${clientId}/${crypto.randomUUID()}-${file.name}`;
      const { error: upErr } = await supabase.storage.from("client-knowledge").upload(path, file, {
        contentType: file.type || "text/plain",
        upsert: false,
      });
      if (upErr) throw upErr;
      const { data: userResp } = await supabase.auth.getUser();
      const { data: doc, error } = await supabase
        .from("client_knowledge_documents")
        .insert({
          client_id: clientId,
          title: file.name,
          source_type: "upload",
          file_path: path,
          mime_type: file.type || "text/plain",
          byte_size: file.size,
          status: "pending",
          created_by: userResp.user?.id ?? null,
        })
        .select()
        .single();
      if (error) throw error;
      const { error: invErr } = await supabase.functions.invoke("ingest-client-knowledge", {
        body: { documentId: doc.id },
      });
      if (invErr) throw invErr;
      return doc;
    },
    onSuccess: () => clientId && qc.invalidateQueries({ queryKey: key(clientId) }),
  });
}

export function useUpdateKnowledgeNote(clientId?: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { id: string; title: string; body: string; tags?: string[]; source_url?: string }) => {
      const { data: doc, error } = await supabase
        .from("client_knowledge_documents")
        .update({
          title: input.title.trim(),
          raw_text: input.body,
          tags: input.tags ?? [],
          source_url: input.source_url ?? null,
          byte_size: input.body.length,
          status: "pending",
          error: null,
        })
        .eq("id", input.id)
        .select()
        .single();
      if (error) throw error;
      const { error: invErr } = await supabase.functions.invoke("ingest-client-knowledge", {
        body: { documentId: input.id },
      });
      if (invErr) throw invErr;
      return doc;
    },
    onSuccess: () => clientId && qc.invalidateQueries({ queryKey: key(clientId) }),
  });
}

export function useUpdateKnowledgeMeta(clientId?: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { id: string; title: string; tags?: string[]; source_url?: string }) => {
      const { error } = await supabase
        .from("client_knowledge_documents")
        .update({
          title: input.title.trim(),
          tags: input.tags ?? [],
          source_url: input.source_url ?? null,
        })
        .eq("id", input.id);
      if (error) throw error;
    },
    onSuccess: () => clientId && qc.invalidateQueries({ queryKey: key(clientId) }),
  });
}

export function useReingestKnowledge(clientId?: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (documentId: string) => {
      await supabase.from("client_knowledge_documents").update({ status: "pending", error: null }).eq("id", documentId);
      const { error } = await supabase.functions.invoke("ingest-client-knowledge", { body: { documentId } });
      if (error) throw error;
    },
    onSuccess: () => clientId && qc.invalidateQueries({ queryKey: key(clientId) }),
  });
}

export function useDeleteKnowledge(clientId?: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (doc: KnowledgeDoc) => {
      if (doc.file_path) {
        await supabase.storage.from("client-knowledge").remove([doc.file_path]);
      }
      const { error } = await supabase.from("client_knowledge_documents").delete().eq("id", doc.id);
      if (error) throw error;
    },
    onSuccess: () => clientId && qc.invalidateQueries({ queryKey: key(clientId) }),
  });
}
