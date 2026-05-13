import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { pairSections, type SectionLite, type SectionPair } from "../utils/sectionMatcher";

export function useSectionDiff(docAId: string | null, docBId: string | null) {
  return useQuery({
    queryKey: ["section-diff", docAId, docBId],
    enabled: !!docAId && !!docBId,
    queryFn: async (): Promise<SectionPair[]> => {
      const ids = [docAId!, docBId!];
      const { data, error } = await supabase
        .from("document_sections")
        .select("id, document_id, section_number, section_title, page_start, page_end, content, sort_order")
        .in("document_id", ids)
        .order("sort_order", { ascending: true });
      if (error) throw error;
      const secs = (data ?? []) as unknown as SectionLite[];
      const a = secs.filter((s) => s.document_id === docAId);
      const b = secs.filter((s) => s.document_id === docBId);
      return pairSections(a, b);
    },
  });
}
