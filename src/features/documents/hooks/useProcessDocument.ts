import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { invokeExtractEntities, invokeProcessDocument } from "@/lib/supabase/functions";
import type { DocumentRow, DocumentStatus } from "./useDocuments";

export function useProcessDocument() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (documentId: string) => invokeProcessDocument(documentId),
    onSuccess: (_data, documentId) => {
      qc.invalidateQueries({ queryKey: ["document", documentId] });
      qc.invalidateQueries({ queryKey: ["documents"] });
    },
  });
}

export function useReprocessDocument() {
  // Same call; processing is idempotent server-side
  return useProcessDocument();
}

export function useExtractEntities() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (documentId: string) => invokeExtractEntities(documentId),
    onSuccess: (_data, documentId) => {
      qc.invalidateQueries({ queryKey: ["document", documentId] });
      qc.invalidateQueries({ queryKey: ["entities", documentId] });
    },
  });
}

const TERMINAL: DocumentStatus[] = ["analyzed", "parsed", "failed"];

export function useProcessingStatus(documentId: string | undefined) {
  return useQuery({
    queryKey: ["document-status", documentId],
    enabled: !!documentId,
    refetchInterval: (q) => {
      const data = q.state.data as DocumentRow | undefined;
      if (!data?.status) return 2000;
      return TERMINAL.includes(data.status) ? false : 2000;
    },
    queryFn: async () => {
      const { data, error } = await supabase
        .from("documents")
        .select(
          "id, status, processing_error, processing_started_at, processing_completed_at, total_pages"
        )
        .eq("id", documentId!)
        .maybeSingle();
      if (error) throw error;
      return data as Pick<
        DocumentRow,
        | "id"
        | "status"
        | "processing_error"
        | "processing_started_at"
        | "processing_completed_at"
        | "total_pages"
      > | null;
    },
  });
}
