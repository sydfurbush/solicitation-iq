import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { FailedAttachment } from "./useImportPriorFromSam";

export type PriorImportHistoryRow = {
  id: string;
  prior_link_id: string;
  prior_solicitation_id: string | null;
  source: string;
  action: "initial" | "retry" | string;
  status: "success" | "partial" | "failed" | "cancelled" | string;
  found_count: number;
  imported_count: number;
  failed_count: number;
  failed_attachments: FailedAttachment[];
  error_message: string | null;
  started_at: string;
  completed_at: string | null;
  performed_by: string | null;
};

export function usePriorImportHistory(priorLinkId: string | undefined) {
  return useQuery({
    queryKey: ["prior-import-history", priorLinkId],
    enabled: !!priorLinkId,
    queryFn: async (): Promise<PriorImportHistoryRow[]> => {
      const { data, error } = await supabase
        .from("prior_import_history")
        .select("*")
        .eq("prior_link_id", priorLinkId!)
        .order("started_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as unknown as PriorImportHistoryRow[];
    },
  });
}

export type LogImportInput = {
  priorLinkId: string;
  priorSolicitationId?: string | null;
  source?: string;
  action: "initial" | "retry";
  status: "success" | "partial" | "failed" | "cancelled";
  foundCount: number;
  importedCount: number;
  failedCount: number;
  failedAttachments?: FailedAttachment[];
  errorMessage?: string | null;
  startedAt: string;
};

export async function logPriorImport(input: LogImportInput) {
  const { data: userRes } = await supabase.auth.getUser();
  const { error } = await supabase.from("prior_import_history").insert({
    prior_link_id: input.priorLinkId,
    prior_solicitation_id: input.priorSolicitationId ?? null,
    source: input.source ?? "sam",
    action: input.action,
    status: input.status,
    found_count: input.foundCount,
    imported_count: input.importedCount,
    failed_count: input.failedCount,
    failed_attachments: input.failedAttachments ?? [],
    error_message: input.errorMessage ?? null,
    started_at: input.startedAt,
    completed_at: new Date().toISOString(),
    performed_by: userRes.user?.id ?? null,
  });
  if (error) console.error("logPriorImport failed", error);
}

export function useInvalidatePriorImportHistory() {
  const qc = useQueryClient();
  return (priorLinkId: string | undefined) => {
    if (!priorLinkId) return;
    qc.invalidateQueries({ queryKey: ["prior-import-history", priorLinkId] });
  };
}
