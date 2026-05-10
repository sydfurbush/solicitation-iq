import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useUser } from "@/features/auth/hooks/useUser";
import type { Database } from "@/integrations/supabase/types";
import type { ClientInput } from "@/lib/validators/client";

export type ClientRow = Database["public"]["Tables"]["clients"]["Row"];
export type ClientWithStats = ClientRow & {
  active_solicitations_count: number;
};

const CLIENTS_KEY = ["clients"] as const;

async function fetchClients(): Promise<ClientWithStats[]> {
  const { data, error } = await supabase
    .from("clients")
    .select("*, solicitations(id, status, deleted_at)")
    .is("deleted_at", null)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []).map((row) => {
    const sols = (row as unknown as { solicitations: { status: string | null; deleted_at: string | null }[] }).solicitations ?? [];
    const active = sols.filter(
      (s) => !s.deleted_at && s.status !== "complete" && s.status !== "archived"
    ).length;
    const { solicitations: _ignored, ...rest } = row as ClientRow & { solicitations: unknown };
    return { ...rest, active_solicitations_count: active } as ClientWithStats;
  });
}

export function useClients() {
  return useQuery({ queryKey: CLIENTS_KEY, queryFn: fetchClients });
}

export function useClient(id: string | undefined) {
  return useQuery({
    queryKey: ["client", id],
    enabled: !!id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("clients")
        .select("*")
        .eq("id", id!)
        .is("deleted_at", null)
        .maybeSingle();
      if (error) throw error;
      return data as ClientRow | null;
    },
  });
}

export function useCreateClient() {
  const qc = useQueryClient();
  const { organization } = useUser();
  return useMutation({
    mutationFn: async (input: ClientInput) => {
      if (!organization?.id) throw new Error("No organization");
      const { data, error } = await supabase
        .from("clients")
        .insert({ ...input, organization_id: organization.id })
        .select()
        .single();
      if (error) throw error;
      return data as ClientRow;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: CLIENTS_KEY });
    },
  });
}

export function useUpdateClient() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, input }: { id: string; input: Partial<ClientInput> }) => {
      const { data, error } = await supabase
        .from("clients")
        .update(input)
        .eq("id", id)
        .select()
        .single();
      if (error) throw error;
      return data as ClientRow;
    },
    onMutate: async ({ id, input }) => {
      await qc.cancelQueries({ queryKey: CLIENTS_KEY });
      const previous = qc.getQueryData<ClientWithStats[]>(CLIENTS_KEY);
      if (previous) {
        qc.setQueryData<ClientWithStats[]>(
          CLIENTS_KEY,
          previous.map((c) => (c.id === id ? { ...c, ...input } : c))
        );
      }
      return { previous };
    },
    onError: (_e, _v, ctx) => {
      if (ctx?.previous) qc.setQueryData(CLIENTS_KEY, ctx.previous);
    },
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: CLIENTS_KEY });
      qc.invalidateQueries({ queryKey: ["client", data.id] });
    },
  });
}

export function useDeleteClient() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("clients")
        .update({ deleted_at: new Date().toISOString() })
        .eq("id", id);
      if (error) throw error;
      return id;
    },
    onMutate: async (id) => {
      await qc.cancelQueries({ queryKey: CLIENTS_KEY });
      const previous = qc.getQueryData<ClientWithStats[]>(CLIENTS_KEY);
      if (previous) {
        qc.setQueryData<ClientWithStats[]>(
          CLIENTS_KEY,
          previous.filter((c) => c.id !== id)
        );
      }
      return { previous };
    },
    onError: (_e, _v, ctx) => {
      if (ctx?.previous) qc.setQueryData(CLIENTS_KEY, ctx.previous);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: CLIENTS_KEY });
    },
  });
}
