import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { sanitizeFilename, getDocumentTypeFromFilename } from "@/features/documents/utils/fileHelpers";
import type { Database } from "@/integrations/supabase/types";
import type { ImportProgress } from "./useImportPriorFromSam";

const BUCKET = "solicitation-documents";

export type UploadPriorInput = {
  title: string;
  externalReference?: string | null;
  notes?: string | null;
  files: File[];
  onProgress?: (p: ImportProgress) => void;
};

export type UploadPriorResult = {
  priorSolicitationId: string;
  priorRecordId: string;
  uploaded: number;
  failed: number;
  failedFiles: { fileName: string; error: string }[];
};

export function useUploadPriorDocuments(currentSolicitationId: string | undefined) {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async (input: UploadPriorInput): Promise<UploadPriorResult> => {
      if (!currentSolicitationId) throw new Error("Missing current solicitation id");
      if (!input.title.trim()) throw new Error("Title is required");
      if (!input.files.length) throw new Error("Select at least one file");
      const report = (p: ImportProgress) => input.onProgress?.(p);

      // 1. Get current solicitation context (client + org)
      report({ stage: "creating", message: "Creating prior solicitation record…" });
      const { data: current, error: curErr } = await supabase
        .from("solicitations")
        .select("client_id, clients!inner(organization_id)")
        .eq("id", currentSolicitationId)
        .maybeSingle();
      if (curErr) throw curErr;
      if (!current?.client_id) throw new Error("Current solicitation not found");
      const organizationId = (current as { clients: { organization_id: string } }).clients.organization_id;

      // 2. Create shadow prior solicitation
      const insertPayload: Database["public"]["Tables"]["solicitations"]["Insert"] = {
        client_id: current.client_id,
        title: input.title.trim(),
        solicitation_number: input.externalReference?.trim() || null,
        status: "archived",
        tags: ["prior", "manual-upload"],
        metadata: {
          imported_from_upload: true,
          imported_for_solicitation: currentSolicitationId,
          imported_at: new Date().toISOString(),
          notes: input.notes ?? null,
        },
      };
      const { data: shadow, error: shadowErr } = await supabase
        .from("solicitations")
        .insert(insertPayload)
        .select("id")
        .single();
      if (shadowErr) throw shadowErr;
      const priorSolicitationId = shadow.id;

      // 3. Link
      const { data: link, error: linkErr } = await supabase
        .from("prior_solicitations")
        .insert({
          solicitation_id: currentSolicitationId,
          prior_solicitation_id: priorSolicitationId,
          external_reference: input.externalReference?.trim() || null,
          external_url: null,
        })
        .select("id")
        .single();
      if (linkErr) throw linkErr;

      // 4. Upload each file
      const total = input.files.length;
      let uploaded = 0;
      const failedFiles: { fileName: string; error: string }[] = [];

      report({
        stage: "downloading",
        message: `Uploading ${total} document(s)…`,
        found: total,
        imported: 0,
        failed: 0,
      });

      for (const file of input.files) {
        try {
          const docId = crypto.randomUUID();
          const safeName = sanitizeFilename(file.name);
          const path = `${organizationId}/${current.client_id}/${priorSolicitationId}/${docId}/${safeName}`;
          const { error: upErr } = await supabase.storage.from(BUCKET).upload(path, file, {
            cacheControl: "3600",
            upsert: false,
            contentType: file.type || undefined,
          });
          if (upErr) throw upErr;

          const { data: doc, error: docErr } = await supabase
            .from("documents")
            .insert({
              id: docId,
              solicitation_id: priorSolicitationId,
              file_name: file.name,
              file_path: path,
              file_size: file.size,
              file_type: file.type || null,
              document_type: getDocumentTypeFromFilename(file.name),
              status: "uploading",
              version: 1,
              is_current: true,
            })
            .select("id")
            .single();
          if (docErr) {
            await supabase.storage.from(BUCKET).remove([path]);
            throw docErr;
          }
          supabase.functions
            .invoke("process-document", { body: { documentId: doc.id } })
            .catch(() => {});
          uploaded += 1;
        } catch (e) {
          failedFiles.push({
            fileName: file.name,
            error: e instanceof Error ? e.message : String(e),
          });
        }
        report({
          stage: "downloading",
          message: `Uploaded ${uploaded} of ${total} document(s)${failedFiles.length ? ` (${failedFiles.length} failed)` : ""}.`,
          found: total,
          imported: uploaded,
          failed: failedFiles.length,
        });
      }

      return {
        priorSolicitationId,
        priorRecordId: link.id,
        uploaded,
        failed: failedFiles.length,
        failedFiles,
      };
    },
    onSuccess: () => {
      if (currentSolicitationId) {
        qc.invalidateQueries({ queryKey: ["prior-solicitation", currentSolicitationId] });
        qc.invalidateQueries({ queryKey: ["solicitations"] });
      }
    },
  });
}
