import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";
import { sanitizeFilename } from "../utils/fileHelpers";

export type DocumentRow = Database["public"]["Tables"]["documents"]["Row"];
export type DocumentType = Database["public"]["Enums"]["document_type"];
export type DocumentStatus = Database["public"]["Enums"]["document_status"];

const BUCKET = "solicitation-documents";

const docsKey = (solicitationId: string) => ["documents", solicitationId] as const;

export function useDocuments(solicitationId: string | undefined) {
  return useQuery({
    queryKey: solicitationId ? docsKey(solicitationId) : ["documents", "none"],
    enabled: !!solicitationId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("documents")
        .select("*")
        .eq("solicitation_id", solicitationId!)
        .is("deleted_at", null)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as DocumentRow[];
    },
  });
}

export function useDocument(id: string | undefined) {
  return useQuery({
    queryKey: ["document", id],
    enabled: !!id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("documents")
        .select("*, document_sections(*)")
        .eq("id", id!)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });
}

export function useDocumentVersions(documentId: string | undefined) {
  return useQuery({
    queryKey: ["document-versions", documentId],
    enabled: !!documentId,
    queryFn: async () => {
      // Walk version chain via replaces_document_id
      const { data: current, error: e1 } = await supabase
        .from("documents")
        .select("*")
        .eq("id", documentId!)
        .maybeSingle();
      if (e1) throw e1;
      if (!current) return [] as DocumentRow[];
      // Find replacement chain (newer versions point to older via replaces_document_id)
      const { data: chain, error: e2 } = await supabase
        .from("documents")
        .select("*")
        .or(`id.eq.${current.id},replaces_document_id.eq.${current.id}`)
        .order("version", { ascending: false });
      if (e2) throw e2;
      return (chain ?? []) as DocumentRow[];
    },
  });
}

export type UploadInput = {
  file: File;
  solicitationId: string;
  clientId: string;
  organizationId: string;
  documentType?: DocumentType;
  replacesDocumentId?: string;
  onProgress?: (pct: number) => void;
};

export function useUploadDocument() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: UploadInput) => {
      const docId = crypto.randomUUID();
      const safeName = sanitizeFilename(input.file.name);
      const path = `${input.organizationId}/${input.clientId}/${input.solicitationId}/${docId}/${safeName}`;

      // Upload to storage
      const { error: upErr } = await supabase.storage.from(BUCKET).upload(path, input.file, {
        cacheControl: "3600",
        upsert: false,
        contentType: input.file.type || undefined,
      });
      if (upErr) throw upErr;
      input.onProgress?.(100);

      let version = 1;
      if (input.replacesDocumentId) {
        const { data: prev } = await supabase
          .from("documents")
          .select("version")
          .eq("id", input.replacesDocumentId)
          .maybeSingle();
        version = (prev?.version ?? 1) + 1;
        await supabase
          .from("documents")
          .update({ is_current: false })
          .eq("id", input.replacesDocumentId);
      }

      const insertPayload: Database["public"]["Tables"]["documents"]["Insert"] = {
        id: docId,
        solicitation_id: input.solicitationId,
        file_name: input.file.name,
        file_path: path,
        file_size: input.file.size,
        file_type: input.file.type || null,
        document_type: input.documentType ?? "other",
        status: "parsed",
        version,
        is_current: true,
        replaces_document_id: input.replacesDocumentId ?? null,
      };

      const { data, error } = await supabase.from("documents").insert(insertPayload).select().single();
      if (error) {
        // Try to clean up the uploaded file on failure
        await supabase.storage.from(BUCKET).remove([path]);
        throw error;
      }
      return data as DocumentRow;
    },
    onSuccess: (doc) => {
      qc.invalidateQueries({ queryKey: docsKey(doc.solicitation_id) });
      qc.invalidateQueries({ queryKey: ["solicitation", doc.solicitation_id] });
    },
  });
}

export function useUpdateDocument() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      id,
      patch,
    }: {
      id: string;
      patch: Partial<Database["public"]["Tables"]["documents"]["Update"]>;
    }) => {
      const { data, error } = await supabase
        .from("documents")
        .update(patch)
        .eq("id", id)
        .select()
        .single();
      if (error) throw error;
      return data as DocumentRow;
    },
    onSuccess: (doc) => {
      qc.invalidateQueries({ queryKey: docsKey(doc.solicitation_id) });
      qc.invalidateQueries({ queryKey: ["document", doc.id] });
    },
  });
}

export function useDeleteDocument() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (doc: DocumentRow) => {
      const { error } = await supabase
        .from("documents")
        .update({ deleted_at: new Date().toISOString() })
        .eq("id", doc.id);
      if (error) throw error;
      return doc;
    },
    onSuccess: (doc) => {
      qc.invalidateQueries({ queryKey: docsKey(doc.solicitation_id) });
      qc.invalidateQueries({ queryKey: ["solicitation", doc.solicitation_id] });
    },
  });
}

export async function getSignedUrl(filePath: string, expiresIn = 60 * 10): Promise<string> {
  const { data, error } = await supabase.storage.from(BUCKET).createSignedUrl(filePath, expiresIn);
  if (error) throw error;
  return data.signedUrl;
}

export async function downloadDocument(doc: DocumentRow) {
  const url = await getSignedUrl(doc.file_path, 60);
  const a = document.createElement("a");
  a.href = url;
  a.download = doc.file_name;
  a.target = "_blank";
  a.rel = "noopener noreferrer";
  document.body.appendChild(a);
  a.click();
  a.remove();
}
