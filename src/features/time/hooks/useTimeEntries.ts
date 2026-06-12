import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";

export type TimeEntry = Database["public"]["Tables"]["time_entries"]["Row"];
export type TimeEntryInsert = Database["public"]["Tables"]["time_entries"]["Insert"];
export type UserRate = Database["public"]["Tables"]["user_rates"]["Row"];

const ENTRIES_KEY = (sol: string | undefined) => ["time-entries", sol ?? "all"] as const;
const RATES_KEY = ["user-rates"] as const;

export function useTimeEntries(solicitationId?: string) {
  return useQuery({
    queryKey: ENTRIES_KEY(solicitationId),
    queryFn: async () => {
      let q = supabase
        .from("time_entries")
        .select("*")
        .order("entry_date", { ascending: false })
        .limit(200);
      if (solicitationId) q = q.eq("solicitation_id", solicitationId);
      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []) as TimeEntry[];
    },
  });
}

export function useLogTime() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: Omit<TimeEntryInsert, "user_id" | "organization_id">) => {
      const { data: auth } = await supabase.auth.getUser();
      const uid = auth.user?.id;
      if (!uid) throw new Error("Not authenticated");
      const { data: prof } = await supabase
        .from("users")
        .select("organization_id")
        .eq("id", uid)
        .maybeSingle();
      const orgId = prof?.organization_id;
      if (!orgId) throw new Error("No organization");
      const { data, error } = await supabase
        .from("time_entries")
        .insert({ ...input, user_id: uid, organization_id: orgId })
        .select()
        .single();
      if (error) throw error;
      return data as TimeEntry;
    },
    onSuccess: (row) => {
      qc.invalidateQueries({ queryKey: ENTRIES_KEY(row.solicitation_id ?? undefined) });
      qc.invalidateQueries({ queryKey: ENTRIES_KEY(undefined) });
      qc.invalidateQueries({ queryKey: ["reports-hub"] });
    },
  });
}

export function useDeleteTimeEntry() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("time_entries").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["time-entries"] });
      qc.invalidateQueries({ queryKey: ["reports-hub"] });
    },
  });
}

export function useUserRates() {
  return useQuery({
    queryKey: RATES_KEY,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("user_rates")
        .select("*, user:users(id, full_name, email)")
        .order("effective_from", { ascending: false });
      if (error) throw error;
      return (data ?? []) as Array<UserRate & { user?: { id: string; full_name: string | null; email: string | null } | null }>;
    },
  });
}

export function useUpsertUserRate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      user_id: string;
      hourly_rate: number;
      weekly_capacity_hours: number;
      effective_from?: string;
    }) => {
      const { data: auth } = await supabase.auth.getUser();
      const uid = auth.user?.id;
      if (!uid) throw new Error("Not authenticated");
      const { data: prof } = await supabase
        .from("users")
        .select("organization_id")
        .eq("id", uid)
        .maybeSingle();
      const orgId = prof?.organization_id;
      if (!orgId) throw new Error("No organization");

      const effective_from = input.effective_from ?? new Date().toISOString().slice(0, 10);

      // Close out any open-ended prior rate for this user
      await supabase
        .from("user_rates")
        .update({ effective_to: effective_from })
        .eq("user_id", input.user_id)
        .is("effective_to", null);

      const { data, error } = await supabase
        .from("user_rates")
        .insert({
          user_id: input.user_id,
          organization_id: orgId,
          hourly_rate: input.hourly_rate,
          weekly_capacity_hours: input.weekly_capacity_hours,
          effective_from,
        })
        .select()
        .single();
      if (error) throw error;
      return data as UserRate;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: RATES_KEY });
      qc.invalidateQueries({ queryKey: ["reports-hub"] });
    },
  });
}
