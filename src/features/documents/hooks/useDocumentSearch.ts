import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type SearchResult = {
  document_id: string;
  document_name: string;
  section_id: string | null;
  section_title: string | null;
  page_number: number | null;
  snippet: string;
  rank: number;
};

function useDebounced<T>(value: T, delay = 300): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);
  return debounced;
}

export function useDocumentSearch(
  solicitationId: string | undefined,
  searchTerm: string
) {
  const term = useDebounced(searchTerm.trim(), 300);

  const query = useQuery({
    queryKey: ["doc-search", solicitationId, term],
    enabled: !!solicitationId && term.length >= 2,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("search_document_content", {
        p_solicitation_id: solicitationId!,
        p_search_term: term,
      });
      if (error) throw error;
      return (data ?? []) as SearchResult[];
    },
  });

  const grouped = useMemo(() => {
    const map = new Map<string, { name: string; results: SearchResult[] }>();
    (query.data ?? []).forEach((r) => {
      if (!map.has(r.document_id)) {
        map.set(r.document_id, { name: r.document_name, results: [] });
      }
      map.get(r.document_id)!.results.push(r);
    });
    return Array.from(map.entries()).map(([documentId, v]) => ({
      documentId,
      ...v,
    }));
  }, [query.data]);

  return { ...query, term, grouped };
}
