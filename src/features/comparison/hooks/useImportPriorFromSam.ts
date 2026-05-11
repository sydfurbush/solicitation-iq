import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

type SamPrefill = {
  title?: string;
  solicitation_number?: string;
  issuing_agency?: string;
  agency_type?: string;
  set_aside?: string;
  release_date?: string;
  proposal_due_date?: string;
  sam_url?: string;
  notes?: string;
  attachments?: { href: string; fileName?: string }[];
};

export type ImportStage =
  | "idle"
  | "lookup"
  | "creating"
  | "downloading"
  | "parsing"
  | "comparing"
  | "done"
  | "error";

export type ImportProgress = {
  stage: ImportStage;
  message: string;
  found?: number;       // attachments found on SAM
  imported?: number;    // attachments successfully downloaded
  failed?: number;      // attachments that failed download
  parsed?: number;      // documents finished processing
  totalDocs?: number;   // total documents being parsed
};

export type ImportPriorInput = {
  /** SAM.gov notice URL (preferred) */
  url?: string | null;
  /** Plain solicitation number e.g. W9124D26RA001 (used if no URL) */
  solicitationNumber?: string | null;
  /** Free-form reference shown to the user; persisted on prior_solicitations */
  externalReference?: string | null;
  /** Optional notes to attach to the new shadow solicitation */
  notes?: string | null;
  /** Optional progress callback */
  onProgress?: (p: ImportProgress) => void;
};

export type ImportPriorResult = {
  priorSolicitationId: string;
  priorRecordId: string;
  imported: number;
  failed: number;
  found: number;
};

/**
 * Orchestrates: SAM lookup → create shadow prior solicitation → import attachments → link.
 * Comparison is NOT auto-run here — caller decides when to invoke compare-solicitations
 * (typically after polling that documents have parsed).
 */
export function useImportPriorFromSam(currentSolicitationId: string | undefined) {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async (input: ImportPriorInput): Promise<ImportPriorResult> => {
      if (!currentSolicitationId) throw new Error("Missing current solicitation id");
      if (!input.url && !input.solicitationNumber) {
        throw new Error("Provide a SAM.gov URL or a solicitation number");
      }
      const report = (p: ImportProgress) => input.onProgress?.(p);

      // 1. Get current solicitation's client_id
      report({ stage: "lookup", message: "Looking up SAM.gov notice…" });
      const { data: current, error: curErr } = await supabase
        .from("solicitations")
        .select("client_id")
        .eq("id", currentSolicitationId)
        .maybeSingle();
      if (curErr) throw curErr;
      if (!current?.client_id) throw new Error("Current solicitation not found");

      // 2. Fetch SAM notice metadata
      const samBody: Record<string, string> = {};
      if (input.url) samBody.url = input.url;
      else if (input.solicitationNumber) samBody.solicitationNumber = input.solicitationNumber;

      const { data: samData, error: samErr } = await supabase.functions.invoke<{
        prefill?: SamPrefill;
        noticeId?: string | null;
        error?: string;
      }>("sam-import", { body: samBody });
      if (samErr) throw samErr;
      if (samData?.error) throw new Error(samData.error);
      const prefill = samData?.prefill;
      if (!prefill) throw new Error("SAM.gov returned no notice for that reference");

      const attachments = prefill.attachments ?? [];
      report({
        stage: "creating",
        message: `Found notice — ${attachments.length} attachment(s). Creating prior record…`,
        found: attachments.length,
      });

      // 3. Create shadow prior solicitation
      const insertPayload = {
        client_id: current.client_id,
        title: prefill.title ?? input.externalReference ?? "Prior solicitation",
        solicitation_number: prefill.solicitation_number ?? input.solicitationNumber ?? null,
        issuing_agency: prefill.issuing_agency ?? null,
        agency_type: prefill.agency_type ?? null,
        set_aside: prefill.set_aside ?? null,
        release_date: prefill.release_date ?? null,
        proposal_due_date: prefill.proposal_due_date ?? null,
        sam_url: prefill.sam_url ?? input.url ?? null,
        status: "archived" as const,
        tags: ["prior", "auto-imported"],
        metadata: {
          imported_from_sam: true,
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

      // 4. Link
      const { data: link, error: linkErr } = await supabase
        .from("prior_solicitations")
        .insert({
          solicitation_id: currentSolicitationId,
          prior_solicitation_id: priorSolicitationId,
          external_reference: input.externalReference ?? prefill.solicitation_number ?? null,
          external_url: prefill.sam_url ?? input.url ?? null,
        })
        .select("id")
        .single();
      if (linkErr) throw linkErr;

      // 5. Pull attachments into the shadow solicitation
      let imported = 0;
      let failed = 0;
      if (attachments.length > 0) {
        report({
          stage: "downloading",
          message: `Downloading ${attachments.length} attachment(s) from SAM.gov…`,
          found: attachments.length,
        });
        const { data: importData, error: importErr } = await supabase.functions.invoke<{
          imported?: number;
          failed?: unknown[];
          total?: number;
          error?: string;
        }>("sam-import-attachments", {
          body: { solicitationId: priorSolicitationId, attachments },
        });
        if (importErr) throw importErr;
        if (importData?.error) throw new Error(importData.error);
        imported = importData?.imported ?? 0;
        failed = (importData?.failed ?? []).length;
        report({
          stage: "downloading",
          message: `Downloaded ${imported} of ${attachments.length} attachment(s)${failed ? ` (${failed} failed)` : ""}.`,
          found: attachments.length,
          imported,
          failed,
        });
      }

      return {
        priorSolicitationId,
        priorRecordId: link.id,
        imported,
        failed,
        found: attachments.length,
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

/**
 * Polls until all of a solicitation's documents have moved out of `uploading`/`processing`.
 * Returns when all are `parsed`/`analyzed`/`failed`, or after a hard timeout.
 */
export async function waitForDocumentsParsed(
  solicitationId: string,
  opts: { timeoutMs?: number; intervalMs?: number } = {},
) {
  const timeoutMs = opts.timeoutMs ?? 4 * 60 * 1000;
  const intervalMs = opts.intervalMs ?? 4000;
  const deadline = Date.now() + timeoutMs;

  while (Date.now() < deadline) {
    const { data, error } = await supabase
      .from("documents")
      .select("status")
      .eq("solicitation_id", solicitationId)
      .is("deleted_at", null);
    if (error) throw error;
    const rows = data ?? [];
    if (rows.length === 0) return { ready: true, total: 0 };
    const pending = rows.filter((r) => r.status === "uploading" || r.status === "processing").length;
    if (pending === 0) return { ready: true, total: rows.length };
    await new Promise((resolve) => setTimeout(resolve, intervalMs));
  }
  return { ready: false, total: -1 };
}
