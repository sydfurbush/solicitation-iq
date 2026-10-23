import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { ONBOARDING_BUCKET, onboardingPath } from "../lib/onboardingFiles";

export function useOnboardingDocuments(clientId: string | undefined) {
  return useQuery({
    queryKey: ["onboarding-docs", clientId],
    enabled: !!clientId,
    refetchInterval: (q) =>
      (q.state.data as any[] | undefined)?.some((d) => d.status === "processing" || d.status === "uploaded") ? 4000 : false,
    queryFn: async () => {
      if (!clientId) return [];
      const { data, error } = await supabase
        .from("client_onboarding_documents")
        .select("*")
        .eq("client_id", clientId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });
}

/** Staff only — clients have no access to this table. */
export function useOnboardingTriage(clientId: string | undefined) {
  return useQuery({
    queryKey: ["onboarding-triage", clientId],
    enabled: !!clientId,
    queryFn: async () => {
      if (!clientId) return [];
      const { data, error } = await supabase.from("client_onboarding_triage").select("*").eq("client_id", clientId);
      if (error) throw error;
      return data ?? [];
    },
  });
}

export async function runTriage(documentId: string) {
  const { error } = await supabase.functions.invoke("triage-onboarding-document", { body: { documentId } });
  if (error) throw error;
}

/** Insert row, upload file. Returns the document id (triage is called separately, one at a time). */
export async function uploadOnboardingFile(clientId: string, file: File, kind: "staff" | "client",
  received?: { via: "email" | "other"; from: string | null; on: string | null },
): Promise<string> {
  const { data: { user } } = await supabase.auth.getUser();
  const id = crypto.randomUUID();
  const path = onboardingPath(clientId, id, file.name);
  const { error: insErr } = await supabase.from("client_onboarding_documents").insert({
    id, client_id: clientId, file_name: file.name, file_path: path, mime_type: file.type || null,
    byte_size: file.size, uploaded_by: user?.id, uploaded_by_kind: kind,
    received_via: kind === "client" ? "portal" : received?.via ?? "other",
    received_from: kind === "client" ? null : received?.from || null,
    received_on: kind === "client" ? null : received?.on || null,
  });
  if (insErr) throw insErr;
  const { error: upErr } = await supabase.storage.from(ONBOARDING_BUCKET).upload(path, file, { contentType: file.type || undefined });
  if (upErr) {
    await supabase.from("client_onboarding_documents").delete().eq("id", id);
    throw upErr;
  }
  return id;
}

export function useDeleteOnboardingDoc(clientId: string | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (doc: { id: string; file_path: string }) => {
      // Storage first: the client delete policy checks the row still exists.
      const { error: rmErr } = await supabase.storage.from(ONBOARDING_BUCKET).remove([doc.file_path]);
      if (rmErr) throw rmErr;
      const { error } = await supabase.from("client_onboarding_documents").delete().eq("id", doc.id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["onboarding-docs", clientId] }),
  });
}

export function useConfirmReview(clientId: string | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (p: { triageId: string; destinations: string[]; note: string }) => {
      const { data: { user } } = await supabase.auth.getUser();
      const { error } = await supabase.from("client_onboarding_triage").update({
        final_destinations: p.destinations, review_note: p.note || null,
        reviewed_by: user?.id, reviewed_at: new Date().toISOString(),
      }).eq("id", p.triageId);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["onboarding-triage", clientId] }),
  });
}

export async function openSignedUrl(path: string) {
  const { data, error } = await supabase.storage.from(ONBOARDING_BUCKET).createSignedUrl(path, 60);
  if (error) throw error;
  window.open(data.signedUrl, "_blank", "noopener");
}

export async function recheckKnowledgeDocument(knowledgeDocumentId: string): Promise<string | null> {
  const { data, error } = await supabase.functions.invoke("recheck-knowledge-document", { body: { knowledgeDocumentId } });
  if (error) {
    let message = error.message;
    const context = (error as { context?: Response }).context;
    try {
      const b = await context?.json();
      if (context?.status === 409) message = "This file is already being checked. View it in Onboarding for its status.";
      else if (b?.error) message = b.error;
    } catch { /* keep default */ }
    throw new Error(message);
  }
  return (data as { documentId?: string | null })?.documentId ?? null;
}

/** Removes a knowledge row and its stored file; chunks cascade. The onboarding copy stays. */
export function useRemoveFromKnowledge(clientId: string | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (knowledgeDocumentId: string) => {
      if (!clientId) throw new Error("Client is required");
      const { data: k, error: readErr } = await supabase.from("client_knowledge_documents").select("id, file_path").eq("id", knowledgeDocumentId).eq("client_id", clientId).maybeSingle();
      if (readErr) throw readErr;
      if (!k) return;
      if (k.file_path) {
        const { error: storageError } = await supabase.storage.from("client-knowledge").remove([k.file_path]);
        if (storageError) throw storageError;
      }
      const { data: deleted, error } = await supabase.from("client_knowledge_documents").delete().eq("id", k.id).eq("client_id", clientId).select("id");
      if (error) throw error;
      if (!deleted?.length) throw new Error("The knowledge file could not be removed. Check your access and try again.");
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["client-knowledge", clientId] });
      qc.invalidateQueries({ queryKey: ["onboarding-docs", clientId] });
    },
  });
}
