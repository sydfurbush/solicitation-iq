import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";

export type ClarificationPackage = Database["public"]["Tables"]["clarification_packages"]["Row"];

export function useClarificationPackages(solicitationId?: string) {
  return useQuery({
    queryKey: ["clarification-packages", solicitationId],
    enabled: !!solicitationId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("clarification_packages")
        .select("*")
        .eq("solicitation_id", solicitationId!)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as ClarificationPackage[];
    },
  });
}

export function useDraftClarification(solicitationId?: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (questionId: string) => {
      const { data, error } = await supabase.functions.invoke("draft-clarification-request", {
        body: { questionId },
      });
      if (error) throw error;
      if ((data as any)?.error) throw new Error((data as any).error);
      return data;
    },
    onSuccess: () => {
      if (solicitationId) {
        qc.invalidateQueries({ queryKey: ["strategic-questions", solicitationId] });
      }
    },
  });
}

export function useMarkClarificationReady(solicitationId?: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, draft, status }: { id: string; draft?: string; status: "drafting" | "ready" }) => {
      const updates: Record<string, unknown> = { clarification_status: status };
      if (draft !== undefined) updates.clarification_draft = draft;
      const { error } = await supabase.from("strategic_questions").update(updates).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      if (solicitationId) qc.invalidateQueries({ queryKey: ["strategic-questions", solicitationId] });
    },
  });
}

export function useCompileClarificationPackage(solicitationId?: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { pdfPath: string; docxPath: string; userId: string; questionIds: string[] }) => {
      if (!solicitationId) throw new Error("Missing solicitationId");
      const { data: pkg, error } = await supabase
        .from("clarification_packages")
        .insert({
          solicitation_id: solicitationId,
          status: "ready",
          pdf_path: input.pdfPath,
          docx_path: input.docxPath,
          compiled_by: input.userId,
          compiled_at: new Date().toISOString(),
        })
        .select()
        .single();
      if (error) throw error;

      // Attach package id to each included question.
      await supabase
        .from("strategic_questions")
        .update({ clarification_package_id: pkg.id })
        .in("id", input.questionIds);

      // Notify all client users of this client.
      const { data: sol } = await supabase
        .from("solicitations")
        .select("client_id, title")
        .eq("id", solicitationId)
        .maybeSingle();
      if (sol?.client_id) {
        const { data: clientUsers } = await supabase
          .from("client_users")
          .select("id")
          .eq("client_id", sol.client_id)
          .is("deleted_at", null);
        const rows = (clientUsers ?? []).map((u) => ({
          client_user_id: u.id,
          solicitation_id: solicitationId,
          notification_type: "package_ready",
          title: "Clarification package ready",
          message: `Your clarification package for "${sol.title}" is ready to download and submit.`,
          link_url: `/portal/solicitations/${solicitationId}`,
        }));
        if (rows.length) await supabase.from("client_notifications").insert(rows);
      }
      return pkg;
    },
    onSuccess: () => {
      if (solicitationId) {
        qc.invalidateQueries({ queryKey: ["clarification-packages", solicitationId] });
        qc.invalidateQueries({ queryKey: ["strategic-questions", solicitationId] });
      }
    },
  });
}

export function useMarkPackageSubmitted(solicitationId?: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { packageId: string; clientUserId: string; submissionReference?: string }) => {
      const { data: pkg, error } = await supabase
        .from("clarification_packages")
        .update({
          status: "submitted",
          submitted_at: new Date().toISOString(),
          submitted_by: input.clientUserId,
          submission_reference: input.submissionReference ?? null,
        })
        .eq("id", input.packageId)
        .select()
        .single();
      if (error) throw error;

      // Flip is_submitted on all attached questions.
      await supabase
        .from("strategic_questions")
        .update({ is_submitted: true, submitted_at: new Date().toISOString() })
        .eq("clarification_package_id", input.packageId);

      return pkg;
    },
    onSuccess: () => {
      if (solicitationId) {
        qc.invalidateQueries({ queryKey: ["clarification-packages", solicitationId] });
        qc.invalidateQueries({ queryKey: ["strategic-questions", solicitationId] });
        qc.invalidateQueries({ queryKey: ["portal-questions", solicitationId] });
      }
    },
  });
}

export async function getSignedPackageUrl(path: string): Promise<string | null> {
  const { data, error } = await supabase.storage.from("reports").createSignedUrl(path, 60 * 10);
  if (error) {
    console.error("signed url error", error);
    return null;
  }
  return data?.signedUrl ?? null;
}
