import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";

type Attachment = { href: string; fileName?: string };

type ImportResult = {
  imported?: number;
  total?: number;
  failed?: { error?: string; status?: number; href?: string }[];
};

export function useSamPullAttachments(solicitationId: string, samUrl: string | null | undefined) {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async () => {
      if (!samUrl) throw new Error("This solicitation has no SAM.gov URL set.");

      toast({ title: "Checking SAM.gov for attachments…" });

      // 1. Refresh notice metadata to get current resourceLinks
      const { data: prefillData, error: prefillErr } = await supabase.functions.invoke("sam-import", {
        body: { url: samUrl },
      });
      if (prefillErr) throw prefillErr;
      const prefill = (prefillData as { prefill?: { attachments?: Attachment[] } })?.prefill;
      const found: Attachment[] = prefill?.attachments ?? [];

      // 2. Skip filenames already on the solicitation
      const { data: existing } = await supabase
        .from("documents")
        .select("file_name")
        .eq("solicitation_id", solicitationId)
        .is("deleted_at", null);

      const existingNames = new Set(
        (existing ?? []).map((d) => (d.file_name ?? "").toLowerCase()),
      );

      const toImport = found.filter((a) => {
        const name = (a.fileName ?? a.href.split("/").pop() ?? "").toLowerCase();
        return !name || !existingNames.has(name);
      });

      const alreadyImported = found.length - toImport.length;

      if (toImport.length === 0) {
        return { found: found.length, alreadyImported, imported: 0, failed: [] as ImportResult["failed"] };
      }

      const { data, error } = await supabase.functions.invoke("sam-import-attachments", {
        body: { solicitationId, attachments: toImport },
      });
      if (error) throw error;
      const r = (data ?? {}) as ImportResult;
      return {
        found: found.length,
        alreadyImported,
        imported: r.imported ?? 0,
        failed: r.failed ?? [],
      };
    },
    onSuccess: (r) => {
      qc.invalidateQueries({ queryKey: ["documents", solicitationId] });
      const failedCount = r.failed?.length ?? 0;
      const firstErr = r.failed?.[0]?.error;

      if (r.found === 0) {
        toast({ title: "SAM.gov returned no attachments for this notice." });
        return;
      }
      if (r.imported === 0 && failedCount === 0) {
        toast({
          title: "Already up to date",
          description: `${r.alreadyImported} attachment(s) already on file.`,
        });
        return;
      }
      toast({
        title: `Imported ${r.imported} new attachment(s)`,
        description: [
          r.alreadyImported ? `${r.alreadyImported} already on file.` : null,
          failedCount ? `${failedCount} failed${firstErr ? ` — ${firstErr.slice(0, 200)}` : ""}` : null,
        ]
          .filter(Boolean)
          .join(" ") || undefined,
        variant: r.imported === 0 && failedCount > 0 ? "destructive" : undefined,
      });
    },
    onError: async (e) => {
      const description = await readEdgeError(e);
      toast({
        title: "SAM.gov pull failed",
        description,
        variant: "destructive",
      });
    },
  });
}
