import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface ExportHistoryRow {
  id: string;
  solicitation_id: string;
  organization_id: string;
  kind: string;
  format: "pdf" | "docx" | string;
  filename: string;
  file_path: string;
  file_size: number | null;
  version: string | null;
  page_size: string | null;
  sections: string[];
  created_by: string | null;
  created_at: string;
}

const REPORTS_BUCKET = "reports";

export function useExportHistory(solicitationId: string | undefined, kind?: string) {
  return useQuery({
    queryKey: ["export-history", solicitationId, kind ?? "all"],
    enabled: !!solicitationId,
    queryFn: async (): Promise<ExportHistoryRow[]> => {
      let q = supabase
        .from("export_history")
        .select("*")
        .eq("solicitation_id", solicitationId!)
        .order("created_at", { ascending: false })
        .limit(50);
      if (kind) q = q.eq("kind", kind);
      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []) as unknown as ExportHistoryRow[];
    },
  });
}

export interface SaveExportInput {
  solicitationId: string;
  kind: string;
  format: string;
  filename: string;
  blob: Blob;
  version?: string | null;
  pageSize?: string | null;
  sections: string[];
}

export function useSaveExport() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: SaveExportInput) => {
      // Resolve org + user
      const { data: auth } = await supabase.auth.getUser();
      const userId = auth.user?.id;
      if (!userId) throw new Error("Not signed in");
      const { data: userRow, error: userErr } = await supabase
        .from("users")
        .select("organization_id")
        .eq("id", userId)
        .maybeSingle();
      if (userErr) throw userErr;
      const orgId = userRow?.organization_id;
      if (!orgId) throw new Error("No organization");

      const path = `${orgId}/${input.solicitationId}/${Date.now()}_${input.filename}`;
      const { error: upErr } = await supabase.storage
        .from(REPORTS_BUCKET)
        .upload(path, input.blob, {
          upsert: false,
          contentType: input.blob.type || undefined,
        });
      if (upErr) throw upErr;

      const { data, error } = await supabase
        .from("export_history")
        .insert({
          solicitation_id: input.solicitationId,
          organization_id: orgId,
          kind: input.kind,
          format: input.format,
          filename: input.filename,
          file_path: path,
          file_size: input.blob.size,
          version: input.version ?? null,
          page_size: input.pageSize ?? null,
          sections: input.sections,
          created_by: userId,
        })
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: (_d, vars) => {
      qc.invalidateQueries({ queryKey: ["export-history", vars.solicitationId] });
    },
  });
}

export async function downloadExportRecord(row: ExportHistoryRow) {
  const { data, error } = await supabase.storage
    .from(REPORTS_BUCKET)
    .createSignedUrl(row.file_path, 60);
  if (error) throw error;
  const a = document.createElement("a");
  a.href = data.signedUrl;
  a.download = row.filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
}
