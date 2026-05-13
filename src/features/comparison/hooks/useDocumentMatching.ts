import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { matchDocuments, type DocLite, type DocMatch } from "../utils/documentMatcher";

export function useDocumentMatching(
  solicitationId: string | undefined,
  revisionAId: string | null,
  revisionBId: string | null,
) {
  return useQuery({
    queryKey: ["doc-matching", solicitationId, revisionAId, revisionBId],
    enabled: !!solicitationId && !!revisionAId && !!revisionBId && revisionAId !== revisionBId,
    queryFn: async (): Promise<DocMatch[]> => {
      const { data, error } = await supabase
        .from("documents")
        .select("id, file_name, total_pages, replaces_document_id, revision_id")
        .eq("solicitation_id", solicitationId!)
        .is("deleted_at", null)
        .in("revision_id", [revisionAId!, revisionBId!]);
      if (error) throw error;
      const docs = (data ?? []) as unknown as DocLite[];
      const aDocs = docs.filter((d) => d.revision_id === revisionAId);
      const bDocs = docs.filter((d) => d.revision_id === revisionBId);
      return matchDocuments(aDocs, bDocs);
    },
  });
}
