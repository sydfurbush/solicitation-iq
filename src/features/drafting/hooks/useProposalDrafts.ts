import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";

export type ProposalDraft = Database["public"]["Tables"]["proposal_drafts"]["Row"];
export type ProposalPackage = Database["public"]["Tables"]["proposal_packages"]["Row"];

const draftsKey = (solId: string) => ["proposal-drafts", solId] as const;
const packagesKey = (solId: string) => ["proposal-packages", solId] as const;

export function useProposalDrafts(solicitationId: string | undefined) {
  return useQuery({
    queryKey: solicitationId ? draftsKey(solicitationId) : ["proposal-drafts", "none"],
    enabled: !!solicitationId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("proposal_drafts")
        .select("*")
        .eq("solicitation_id", solicitationId!);
      if (error) throw error;
      return (data ?? []) as ProposalDraft[];
    },
  });
}

export function useSaveDraft(solicitationId: string | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { outlineNodeId: string; markdown: string; existingDraftId?: string }) => {
      if (!solicitationId) throw new Error("Missing solicitationId");
      const wordCount = input.markdown.trim().split(/\s+/).filter(Boolean).length;
      const pageEstimate = Math.max(0, Math.round(wordCount / 350));
      const payload = {
        outline_node_id: input.outlineNodeId,
        solicitation_id: solicitationId,
        content_json: { markdown: input.markdown },
        content_html: input.markdown,
        word_count: wordCount,
        page_estimate: pageEstimate,
      };
      const { data, error } = await supabase
        .from("proposal_drafts")
        .upsert(payload, { onConflict: "outline_node_id" })
        .select()
        .single();
      if (error) throw error;
      return data as ProposalDraft;
    },
    onSuccess: () => {
      if (solicitationId) qc.invalidateQueries({ queryKey: draftsKey(solicitationId) });
    },
  });
}

export function useAiDraftSection(solicitationId: string | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (outlineNodeId: string) => {
      const { data, error } = await supabase.functions.invoke("draft-section", { body: { outlineNodeId } });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      return data;
    },
    onSuccess: () => {
      if (solicitationId) qc.invalidateQueries({ queryKey: draftsKey(solicitationId) });
    },
  });
}

export function useAiPolishSection(solicitationId: string | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { draftId: string; action: "tighten" | "expand" | "rewrite_to_theme" | "compliance_check" }) => {
      const { data, error } = await supabase.functions.invoke("polish-section", { body: input });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      return data;
    },
    onSuccess: () => {
      if (solicitationId) qc.invalidateQueries({ queryKey: draftsKey(solicitationId) });
    },
  });
}

export function useProposalPackages(solicitationId: string | undefined) {
  return useQuery({
    queryKey: solicitationId ? packagesKey(solicitationId) : ["proposal-packages", "none"],
    enabled: !!solicitationId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("proposal_packages")
        .select("*")
        .eq("solicitation_id", solicitationId!)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as ProposalPackage[];
    },
  });
}

export function useCompileProposal(solicitationId: string | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.functions.invoke("compile-proposal", { body: { solicitationId } });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      return data;
    },
    onSuccess: () => {
      if (solicitationId) qc.invalidateQueries({ queryKey: packagesKey(solicitationId) });
    },
  });
}

export async function downloadPackage(pkg: ProposalPackage): Promise<void> {
  const { data, error } = await supabase.storage.from("reports").createSignedUrl(pkg.storage_path, 600);
  if (error) throw error;
  const a = document.createElement("a");
  a.href = data.signedUrl;
  a.download = pkg.storage_path.split("/").pop() ?? "proposal.docx";
  document.body.appendChild(a);
  a.click();
  a.remove();
}
