import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";

export type RiskRow = Database["public"]["Tables"]["risks"]["Row"];
export type RiskSeverity = Database["public"]["Enums"]["risk_severity"];

const key = (id: string) => ["risks", id] as const;

export function useRisks(solicitationId: string | undefined) {
  return useQuery({
    queryKey: solicitationId ? key(solicitationId) : ["risks", "none"],
    enabled: !!solicitationId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("risks")
        .select("*")
        .eq("solicitation_id", solicitationId!)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as RiskRow[];
    },
  });
}

export function useCreateRisk(solicitationId: string | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: Partial<RiskRow> & Pick<RiskRow, "title" | "description">) => {
      if (!solicitationId) throw new Error("Missing solicitationId");
      const { error } = await supabase.from("risks").insert({
        solicitation_id: solicitationId,
        title: input.title,
        description: input.description,
        severity: input.severity ?? "medium",
        source_document_id: input.source_document_id ?? null,
        source_citation: input.source_citation ?? null,
        source_quote: input.source_quote ?? null,
        mitigation_strategy: input.mitigation_strategy ?? null,
        is_ai_generated: false,
      });
      if (error) throw error;
    },
    onSuccess: () => solicitationId && qc.invalidateQueries({ queryKey: key(solicitationId) }),
  });
}

export function useUpdateRisk(solicitationId: string | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: Partial<RiskRow> }) => {
      const { error } = await supabase.from("risks").update(updates).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => solicitationId && qc.invalidateQueries({ queryKey: key(solicitationId) }),
  });
}

export function useDeleteRisk(solicitationId: string | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("risks").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => solicitationId && qc.invalidateQueries({ queryKey: key(solicitationId) }),
  });
}

export function useMarkRiskMitigated(solicitationId: string | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, isMitigated }: { id: string; isMitigated: boolean }) => {
      const { error } = await supabase
        .from("risks")
        .update({ is_mitigated: isMitigated })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => solicitationId && qc.invalidateQueries({ queryKey: key(solicitationId) }),
  });
}

export function useIdentifyRisksOpportunities(solicitationId: string | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input?: { regenerate?: boolean }) => {
      if (!solicitationId) throw new Error("Missing solicitationId");
      const { data, error } = await supabase.functions.invoke("identify-risks-opportunities", {
        body: { solicitationId, regenerate: input?.regenerate },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      // Poll solicitations.metadata.risks_opportunities_job until job completes.
      const POLL_MS = 3000;
      const MAX_MS = 10 * 60 * 1000; // 10 minutes
      const start = Date.now();
      // eslint-disable-next-line no-constant-condition
      while (true) {
        if (Date.now() - start > MAX_MS) {
          throw new Error("Identify risks/opportunities timed out. Check back in a moment.");
        }
        await new Promise((r) => setTimeout(r, POLL_MS));
        const { data: row, error: pollErr } = await supabase
          .from("solicitations")
          .select("metadata")
          .eq("id", solicitationId)
          .maybeSingle();
        if (pollErr) throw pollErr;
        const job = (row?.metadata as { risks_opportunities_job?: { status?: string; error_message?: string; risks_count?: number; opportunities_count?: number } } | null)?.risks_opportunities_job;
        if (!job || job.status === "processing") continue;
        if (job.status === "failed") throw new Error(job.error_message || "Identify risks/opportunities failed.");
        if (job.status === "completed") {
          return { success: true, risks_count: job.risks_count ?? 0, opportunities_count: job.opportunities_count ?? 0 };
        }
      }
    },
    onSuccess: () => {
      if (solicitationId) {
        qc.invalidateQueries({ queryKey: key(solicitationId) });
        qc.invalidateQueries({ queryKey: ["opportunities", solicitationId] });
        qc.invalidateQueries({ queryKey: ["solicitation", solicitationId] });
      }
    },
  });
}

export type RisksOpportunitiesJob = {
  status?: "processing" | "completed" | "failed" | string;
  error_message?: string;
  started_at?: string;
  completed_at?: string;
  risks_count?: number;
  opportunities_count?: number;
};

export function useRisksOpportunitiesJobStatus(solicitationId: string | undefined) {
  const qc = useQueryClient();
  return useQuery({
    queryKey: ["risks-opportunities-job", solicitationId],
    enabled: !!solicitationId,
    refetchInterval: (query) => {
      const job = query.state.data as RisksOpportunitiesJob | null;
      return job?.status === "processing" ? 3000 : false;
    },
    queryFn: async () => {
      const { data, error } = await supabase
        .from("solicitations")
        .select("metadata")
        .eq("id", solicitationId!)
        .maybeSingle();
      if (error) throw error;
      const job =
        (data?.metadata as { risks_opportunities_job?: RisksOpportunitiesJob } | null)
          ?.risks_opportunities_job ?? null;
      // If job just completed, refresh dependent queries
      if (job?.status === "completed" && solicitationId) {
        qc.invalidateQueries({ queryKey: key(solicitationId) });
        qc.invalidateQueries({ queryKey: ["opportunities", solicitationId] });
      }
      return job;
    },
  });
}
