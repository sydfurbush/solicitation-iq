import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";
import type { ReportContent, ReportType, ReportOptions } from "../templates/types";

export type ReportRow = Database["public"]["Tables"]["executive_reports"]["Row"];

const KEY = (id: string) => ["reports", id] as const;
const ONE = (id: string) => ["report", id] as const;

export function useReports(solicitationId: string | undefined) {
  return useQuery({
    queryKey: solicitationId ? KEY(solicitationId) : ["reports", "none"],
    enabled: !!solicitationId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("executive_reports")
        .select("*, generated_by_user:users!executive_reports_generated_by_fkey(id, full_name, avatar_url)")
        .eq("solicitation_id", solicitationId!)
        .order("created_at", { ascending: false });
      if (error) {
        // Fallback without join if FK alias not present
        const { data: data2, error: error2 } = await supabase
          .from("executive_reports")
          .select("*")
          .eq("solicitation_id", solicitationId!)
          .order("created_at", { ascending: false });
        if (error2) throw error2;
        return (data2 ?? []) as ReportRow[];
      }
      return (data ?? []) as ReportRow[];
    },
  });
}

export function useReport(reportId: string | undefined) {
  return useQuery({
    queryKey: reportId ? ONE(reportId) : ["report", "none"],
    enabled: !!reportId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("executive_reports")
        .select("*")
        .eq("id", reportId!)
        .maybeSingle();
      if (error) throw error;
      return data as ReportRow | null;
    },
  });
}

export function useGenerateReport(solicitationId: string | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { reportType: ReportType; options?: ReportOptions }) => {
      if (!solicitationId) throw new Error("Missing solicitationId");
      const { data, error } = await supabase.functions.invoke("generate-report", {
        body: { solicitationId, reportType: input.reportType, options: input.options ?? {} },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      return data;
    },
    onSuccess: () => solicitationId && qc.invalidateQueries({ queryKey: KEY(solicitationId) }),
  });
}

export function useDeleteReport(solicitationId: string | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (reportId: string) => {
      const { data: row } = await supabase.from("executive_reports").select("file_path").eq("id", reportId).maybeSingle();
      if (row?.file_path) {
        await supabase.storage.from("reports").remove([row.file_path]);
      }
      const { error } = await supabase.from("executive_reports").delete().eq("id", reportId);
      if (error) throw error;
    },
    onSuccess: () => solicitationId && qc.invalidateQueries({ queryKey: KEY(solicitationId) }),
  });
}

export function usePublishReport(solicitationId: string | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ reportId, publish, clientAccessible }: { reportId: string; publish: boolean; clientAccessible?: boolean }) => {
      const { error } = await supabase
        .from("executive_reports")
        .update({
          is_published: publish,
          published_at: publish ? new Date().toISOString() : null,
          ...(clientAccessible !== undefined ? { client_accessible: clientAccessible } : {}),
        })
        .eq("id", reportId);
      if (error) throw error;
    },
    onSuccess: () => {
      if (solicitationId) {
        qc.invalidateQueries({ queryKey: KEY(solicitationId) });
      }
    },
  });
}

export function useUpdateReportContent(solicitationId: string | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ reportId, content, title }: { reportId: string; content: ReportContent; title?: string }) => {
      const { error } = await supabase
        .from("executive_reports")
        .update(title ? { content: content as never, title } : { content: content as never })
        .eq("id", reportId);
      if (error) throw error;
    },
    onSuccess: (_d, vars) => {
      qc.invalidateQueries({ queryKey: ONE(vars.reportId) });
      if (solicitationId) qc.invalidateQueries({ queryKey: KEY(solicitationId) });
    },
  });
}

export async function uploadReportFile(solicitationId: string, reportId: string, blob: Blob, filename: string) {
  const path = `${solicitationId}/${reportId}/${filename}`;
  const { error } = await supabase.storage.from("reports").upload(path, blob, {
    upsert: true,
    contentType: blob.type,
  });
  if (error) throw error;
  await supabase.from("executive_reports").update({ file_path: path }).eq("id", reportId);
  return path;
}

export async function getReportFileUrl(filePath: string, expiresInSec = 3600) {
  const { data, error } = await supabase.storage.from("reports").createSignedUrl(filePath, expiresInSec);
  if (error) throw error;
  return data.signedUrl;
}
