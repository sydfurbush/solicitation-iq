import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useDebounce } from "@/hooks/useDebounce";

export interface SearchResult {
  id: string;
  type: "solicitation" | "client" | "report" | "document";
  title: string;
  subtitle?: string;
  href: string;
}

export function useGlobalSearch(query: string) {
  const debounced = useDebounce(query.trim(), 200);

  return useQuery<SearchResult[]>({
    queryKey: ["global-search", debounced],
    enabled: debounced.length > 1,
    queryFn: async () => {
      const term = `%${debounced}%`;
      const [sols, clients, reports, docs] = await Promise.all([
        supabase
          .from("solicitations")
          .select("id,title,solicitation_number,issuing_agency")
          .or(`title.ilike.${term},solicitation_number.ilike.${term}`)
          .is("deleted_at", null)
          .limit(8),
        supabase
          .from("clients")
          .select("id,name,industry")
          .ilike("name", term)
          .is("deleted_at", null)
          .limit(5),
        supabase
          .from("executive_reports")
          .select("id,title,solicitation_id")
          .ilike("title", term)
          .limit(5),
        supabase
          .from("documents")
          .select("id,file_name,solicitation_id")
          .ilike("file_name", term)
          .is("deleted_at", null)
          .limit(5),
      ]);

      const results: SearchResult[] = [];
      (sols.data ?? []).forEach((s: any) =>
        results.push({
          id: s.id,
          type: "solicitation",
          title: s.title,
          subtitle: [s.solicitation_number, s.issuing_agency].filter(Boolean).join(" · "),
          href: `/solicitations/${s.id}`,
        }),
      );
      (clients.data ?? []).forEach((c: any) =>
        results.push({
          id: c.id,
          type: "client",
          title: c.name,
          subtitle: c.industry ?? undefined,
          href: `/clients/${c.id}`,
        }),
      );
      (reports.data ?? []).forEach((r: any) =>
        results.push({
          id: r.id,
          type: "report",
          title: r.title,
          href: `/solicitations/${r.solicitation_id}`,
        }),
      );
      (docs.data ?? []).forEach((d: any) =>
        results.push({
          id: d.id,
          type: "document",
          title: d.file_name,
          href: `/solicitations/${d.solicitation_id}`,
        }),
      );
      return results;
    },
  });
}
