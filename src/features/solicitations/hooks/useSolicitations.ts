import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";
import type { SolicitationFullInput, SolicitationStatus } from "@/lib/validators/solicitation";

export type SolicitationRow = Database["public"]["Tables"]["solicitations"]["Row"];
export type SolicitationWithClient = SolicitationRow & {
  client: { id: string; name: string; logo_url: string | null } | null;
  documents_count: number;
  questions_count: number;
  risks_count: number;
  opportunities_count: number;
};

export interface SolicitationFilters {
  search?: string;
  clientIds?: string[];
  statuses?: SolicitationStatus[];
  phases?: string[];
  dueFrom?: string;
  dueTo?: string;
  includeDeleted?: boolean;
}

const LIST_KEY = (f: SolicitationFilters) => ["solicitations", f] as const;

function applyTextFilters(
  rows: SolicitationWithClient[],
  filters: SolicitationFilters
): SolicitationWithClient[] {
  const term = filters.search?.trim().toLowerCase();
  return rows.filter((r) => {
    if (term) {
      const haystack = [r.title, r.solicitation_number, r.issuing_agency]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      if (!haystack.includes(term)) return false;
    }
    if (filters.clientIds?.length && !filters.clientIds.includes(r.client_id)) return false;
    if (filters.statuses?.length && !filters.statuses.includes(r.status as SolicitationStatus)) return false;
    if (filters.phases?.length && !filters.phases.includes(r.current_phase ?? "")) return false;
    if (filters.dueFrom && r.proposal_due_date && new Date(r.proposal_due_date) < new Date(filters.dueFrom)) return false;
    if (filters.dueTo && r.proposal_due_date && new Date(r.proposal_due_date) > new Date(filters.dueTo)) return false;
    return true;
  });
}

export function useSolicitations(filters: SolicitationFilters = {}) {
  return useQuery({
    queryKey: LIST_KEY(filters),
    queryFn: async () => {
      let query = supabase
        .from("solicitations")
        .select(
          `*,
           client:clients(id, name, logo_url),
           documents(id),
           strategic_questions(id),
           risks(id),
           opportunities(id)`
        )
        .is("documents.deleted_at", null)
        .order("created_at", { ascending: false });
      if (!filters.includeDeleted) {
        query = query.is("deleted_at", null);
      }
      const { data, error } = await query;
      if (error) throw error;
      const rows: SolicitationWithClient[] = (data ?? []).map((row) => {
        const r = row as unknown as SolicitationRow & {
          client: SolicitationWithClient["client"];
          documents: { id: string }[];
          strategic_questions: { id: string }[];
          risks: { id: string }[];
          opportunities: { id: string }[];
        };
        return {
          ...r,
          documents_count: r.documents?.length ?? 0,
          questions_count: r.strategic_questions?.length ?? 0,
          risks_count: r.risks?.length ?? 0,
          opportunities_count: r.opportunities?.length ?? 0,
        };
      });
      return applyTextFilters(rows, filters);
    },
  });
}

export function useSolicitation(id: string | undefined) {
  return useQuery({
    queryKey: ["solicitation", id],
    enabled: !!id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("solicitations")
        .select(
          `*,
           client:clients(id, name, logo_url, industry, website),
           documents(id),
           strategic_questions(id),
           risks(id),
           opportunities(id)`
        )
        .eq("id", id!)
        .is("deleted_at", null)
        .is("documents.deleted_at", null)
        .maybeSingle();
      if (error) throw error;
      if (!data) return null;
      const r = data as unknown as SolicitationRow & {
        client: { id: string; name: string; logo_url: string | null; industry: string | null; website: string | null } | null;
        documents: { id: string }[];
        strategic_questions: { id: string }[];
        risks: { id: string }[];
        opportunities: { id: string }[];
      };
      return {
        ...r,
        documents_count: r.documents?.length ?? 0,
        questions_count: r.strategic_questions?.length ?? 0,
        risks_count: r.risks?.length ?? 0,
        opportunities_count: r.opportunities?.length ?? 0,
      };
    },
  });
}

function toInsert(input: Partial<SolicitationFullInput>) {
  const { tags, notes, ...rest } = input;
  const payload: Record<string, unknown> = { ...rest };
  if (tags !== undefined) payload.tags = tags.length ? tags : [];
  if (notes !== undefined) payload.metadata = notes ? { notes } : {};
  return payload;
}

export function useCreateSolicitation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: SolicitationFullInput) => {
      const payload = toInsert(input) as Database["public"]["Tables"]["solicitations"]["Insert"];
      const { data, error } = await supabase
        .from("solicitations")
        .insert({ ...payload, status: "intake" })
        .select()
        .single();
      if (error) throw error;
      return data as SolicitationRow;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["solicitations"] });
    },
  });
}

export type SolicitationUpdateInput = Partial<SolicitationFullInput> & {
  ai_summary?: string | null;
};

export function useUpdateSolicitation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      id,
      input,
    }: {
      id: string;
      input: SolicitationUpdateInput;
    }) => {
      const { ai_summary, ...rest } = input;
      const payload = toInsert(rest) as Record<string, unknown>;
      if (ai_summary !== undefined) payload.ai_summary = ai_summary;
      const { data, error } = await supabase
        .from("solicitations")
        .update(payload as Database["public"]["Tables"]["solicitations"]["Update"])
        .eq("id", id)
        .select()
        .single();
      if (error) throw error;
      return data as SolicitationRow;
    },
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ["solicitations"] });
      qc.invalidateQueries({ queryKey: ["solicitation", data.id] });
      qc.invalidateQueries({ queryKey: ["client-solicitations"] });
    },
  });
}

export function useUpdateSolicitationStatus() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, status }: { id: string; status: SolicitationStatus }) => {
      const { data, error } = await supabase
        .from("solicitations")
        .update({ status })
        .eq("id", id)
        .select()
        .single();
      if (error) throw error;
      return data as SolicitationRow;
    },
    onMutate: async ({ id, status }) => {
      await qc.cancelQueries({ queryKey: ["solicitation", id] });
      const prev = qc.getQueryData(["solicitation", id]);
      if (prev) {
        qc.setQueryData(["solicitation", id], { ...(prev as object), status });
      }
      return { prev };
    },
    onError: (_e, vars, ctx) => {
      if (ctx?.prev) qc.setQueryData(["solicitation", vars.id], ctx.prev);
    },
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ["solicitations"] });
      qc.invalidateQueries({ queryKey: ["solicitation", data.id] });
    },
  });
}

export function useDeleteSolicitation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("solicitations")
        .update({ deleted_at: new Date().toISOString() })
        .eq("id", id);
      if (error) throw error;
      return id;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["solicitations"] });
    },
  });
}

export function useRestoreSolicitation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("solicitations")
        .update({ deleted_at: null })
        .eq("id", id);
      if (error) throw error;
      return id;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["solicitations"] });
    },
  });
}
