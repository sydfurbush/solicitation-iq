import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";

export type PriorSolicitationRow = Database["public"]["Tables"]["prior_solicitations"]["Row"];

const key = (id: string) => ["prior-solicitation", id] as const;

export function usePriorSolicitation(solicitationId: string | undefined) {
  return useQuery({
    queryKey: solicitationId ? key(solicitationId) : ["prior-solicitation", "none"],
    enabled: !!solicitationId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("prior_solicitations")
        .select("*")
        .eq("solicitation_id", solicitationId!)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return data as PriorSolicitationRow | null;
    },
  });
}

export type LinkInput = {
  priorSolicitationId?: string | null;
  externalReference?: string | null;
  externalUrl?: string | null;
};

export function useLinkPriorSolicitation(solicitationId: string | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: LinkInput) => {
      if (!solicitationId) throw new Error("Missing solicitationId");
      const { data, error } = await supabase
        .from("prior_solicitations")
        .insert({
          solicitation_id: solicitationId,
          prior_solicitation_id: input.priorSolicitationId ?? null,
          external_reference: input.externalReference ?? null,
          external_url: input.externalUrl ?? null,
        })
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => solicitationId && qc.invalidateQueries({ queryKey: key(solicitationId) }),
  });
}

export function useUnlinkPriorSolicitation(solicitationId: string | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("prior_solicitations").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => solicitationId && qc.invalidateQueries({ queryKey: key(solicitationId) }),
  });
}

export function useComparisonResults(solicitationId: string | undefined) {
  const { data } = usePriorSolicitation(solicitationId);
  return {
    summary: data?.comparison_summary ?? null,
    changes: (data?.changes_identified ?? null) as ComparisonChanges | null,
    completedAt: data?.comparison_completed_at ?? null,
    priorRecord: data,
  };
}

export type ChangeItem = {
  type: "added" | "removed" | "modified";
  text: string;
  prior_text?: string | null;
  significance?: "high" | "medium" | "low";
  citation?: string | null;
};

export type EvalFactorChange = {
  type: "added" | "removed" | "weight_changed" | "modified";
  factor: string;
  prior_weight?: string | null;
  current_weight?: string | null;
  notes?: string | null;
};

export type DateChange = {
  field: string;
  prior?: string | null;
  current?: string | null;
};

export type FinancialChange = {
  field: string;
  prior?: string | null;
  current?: string | null;
  delta?: string | null;
};

export type Insight = {
  title: string;
  detail: string;
  category?: "agency" | "incumbent" | "competitor" | "risk" | "opportunity" | "strategy";
};

export type ComparisonChanges = {
  requirements?: ChangeItem[];
  evaluation_factors?: EvalFactorChange[];
  scope?: ChangeItem[];
  contract_structure?: ChangeItem[];
  timeline?: DateChange[];
  financial?: FinancialChange[];
  personnel?: ChangeItem[];
  compliance?: ChangeItem[];
  insights?: Insight[];
  recommendations?: string[];
};
