import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";

type Json = Database["public"]["Tables"]["executive_reports"]["Row"];

export type PipelineRow = {
  organization_id: string;
  status: string | null;
  stage: string | null;
  phase: string | null;
  client_id: string | null;
  solicitation_count: number;
  est_value_low_sum: number;
  est_value_high_sum: number;
};

export type OnTimeRow = {
  organization_id: string;
  client_id: string | null;
  lead_user_id: string | null;
  submitted_count: number;
  on_time_count: number;
  total_count: number;
};

export type WorkloadRow = {
  user_id: string;
  organization_id: string | null;
  full_name: string | null;
  email: string | null;
  active_assignments: number;
  overdue_items: number;
  hours_logged_30d: number;
  cost_30d: number;
  activity_7d: number;
  weekly_capacity_hours: number;
  hourly_rate: number;
};

export type PortfolioRow = {
  client_id: string;
  organization_id: string | null;
  client_name: string | null;
  solicitation_count: number;
  active_count: number;
  total_est_value: number;
  won_count: number;
  lost_count: number;
  no_bid_count: number;
  awarded_value_total: number;
  cost_to_bid_total: number;
};

const fromView = (name: string) =>
  // Views aren't in generated types — cast through unknown to keep TS happy.
  (supabase as unknown as { from: (n: string) => ReturnType<typeof supabase.from> }).from(name);

export function usePipeline(opts?: { clientId?: string | null }) {
  return useQuery({
    queryKey: ["reports-hub", "pipeline", opts?.clientId ?? null],
    queryFn: async () => {
      let q = fromView("v_pipeline_summary").select("*");
      if (opts?.clientId) q = q.eq("client_id", opts.clientId);
      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []) as unknown as PipelineRow[];
    },
  });
}

export function useOnTimeRate(opts?: { clientId?: string | null }) {
  return useQuery({
    queryKey: ["reports-hub", "ontime", opts?.clientId ?? null],
    queryFn: async () => {
      let q = fromView("v_ontime_rate").select("*");
      if (opts?.clientId) q = q.eq("client_id", opts.clientId);
      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []) as unknown as OnTimeRow[];
    },
  });
}

export function useWorkload() {
  return useQuery({
    queryKey: ["reports-hub", "workload"],
    queryFn: async () => {
      const { data, error } = await fromView("v_user_workload").select("*").order("hours_logged_30d", { ascending: false });
      if (error) throw error;
      return (data ?? []) as unknown as WorkloadRow[];
    },
  });
}

export function useClientPortfolio() {
  return useQuery({
    queryKey: ["reports-hub", "portfolio"],
    queryFn: async () => {
      const { data, error } = await fromView("v_client_portfolio").select("*").order("active_count", { ascending: false });
      if (error) throw error;
      return (data ?? []) as unknown as PortfolioRow[];
    },
  });
}

export type DeliverableRow = Json & {
  solicitation?: { id: string; title: string; client_id: string; clients?: { name: string } | null } | null;
};

export function useDeliverablesLibrary(opts?: { clientId?: string | null; reportType?: string | null }) {
  return useQuery({
    queryKey: ["reports-hub", "deliverables", opts?.clientId ?? null, opts?.reportType ?? null],
    queryFn: async () => {
      let q = supabase
        .from("executive_reports")
        .select("*, solicitation:solicitations(id, title, client_id, clients(name))")
        .order("created_at", { ascending: false })
        .limit(500);
      if (opts?.reportType) q = q.eq("report_type", opts.reportType);
      const { data, error } = await q;
      if (error) throw error;
      let rows = (data ?? []) as unknown as DeliverableRow[];
      if (opts?.clientId) {
        rows = rows.filter((r) => r.solicitation?.client_id === opts.clientId);
      }
      return rows;
    },
  });
}

export function useClientsList() {
  return useQuery({
    queryKey: ["reports-hub", "clients-list"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("clients")
        .select("id, name")
        .is("deleted_at" as never, null as never)
        .order("name");
      if (error) throw error;
      return (data ?? []) as Array<{ id: string; name: string }>;
    },
  });
}
