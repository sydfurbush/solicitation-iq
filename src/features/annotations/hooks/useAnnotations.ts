import { useEffect } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { AnnotationRow, AnnotationType } from "../utils/annotationHelpers";

const solKey = (id: string) => ["annotations", "solicitation", id] as const;
const docKey = (id: string) => ["annotations", "document", id] as const;

export interface AnnotationFilters {
  types?: AnnotationType[];
  authorId?: string;
  resolved?: "all" | "open" | "resolved";
  documentId?: string;
}

export function useAnnotations(
  solicitationId: string | undefined,
  filters?: AnnotationFilters
) {
  const qc = useQueryClient();

  // Realtime subscription
  useEffect(() => {
    if (!solicitationId) return;
    const channel = supabase
      .channel(`annotations-${solicitationId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "annotations", filter: `solicitation_id=eq.${solicitationId}` },
        () => {
          qc.invalidateQueries({ queryKey: solKey(solicitationId) });
        }
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [solicitationId, qc]);

  return useQuery({
    queryKey: solicitationId ? solKey(solicitationId) : ["annotations", "none"],
    enabled: !!solicitationId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("annotations")
        .select("*")
        .eq("solicitation_id", solicitationId!)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as AnnotationRow[];
    },
    select: (rows) => {
      let out = rows;
      if (filters?.types?.length) out = out.filter((r) => filters.types!.includes(r.annotation_type));
      if (filters?.authorId) out = out.filter((r) => r.user_id === filters.authorId);
      if (filters?.documentId) out = out.filter((r) => r.document_id === filters.documentId);
      if (filters?.resolved === "open") out = out.filter((r) => !r.is_resolved);
      if (filters?.resolved === "resolved") out = out.filter((r) => r.is_resolved);
      return out;
    },
  });
}

export function useDocumentAnnotations(documentId: string | undefined) {
  return useQuery({
    queryKey: documentId ? docKey(documentId) : ["annotations", "doc", "none"],
    enabled: !!documentId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("annotations")
        .select("*")
        .eq("document_id", documentId!)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as AnnotationRow[];
    },
  });
}

export function useAnnotationCounts(solicitationId: string | undefined) {
  const { data } = useAnnotations(solicitationId);
  return (() => {
    const counts: Record<string, number> = { total: 0, unresolved: 0 };
    (data ?? []).forEach((a) => {
      counts.total += 1;
      counts[a.annotation_type] = (counts[a.annotation_type] ?? 0) + 1;
      if (!a.is_resolved) counts.unresolved += 1;
    });
    return counts;
  })();
}

interface CreateInput {
  annotation_type: AnnotationType;
  content: string;
  document_id?: string | null;
  section_id?: string | null;
  page_number?: number | null;
  position_data?: Record<string, unknown> | null;
}

export function useCreateAnnotation(solicitationId: string | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: CreateInput) => {
      if (!solicitationId) throw new Error("Missing solicitationId");
      const { data: auth } = await supabase.auth.getUser();
      if (!auth.user) throw new Error("Not authenticated");
      const { error } = await supabase.from("annotations").insert({
        solicitation_id: solicitationId,
        user_id: auth.user.id,
        annotation_type: input.annotation_type,
        content: input.content,
        document_id: input.document_id ?? null,
        section_id: input.section_id ?? null,
        page_number: input.page_number ?? null,
        position_data: (input.position_data ?? null) as never,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      if (solicitationId) qc.invalidateQueries({ queryKey: solKey(solicitationId) });
    },
  });
}

export function useUpdateAnnotation(solicitationId: string | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: Partial<AnnotationRow> }) => {
      const { error } = await supabase.from("annotations").update(updates).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => solicitationId && qc.invalidateQueries({ queryKey: solKey(solicitationId) }),
  });
}

export function useDeleteAnnotation(solicitationId: string | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("annotations").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => solicitationId && qc.invalidateQueries({ queryKey: solKey(solicitationId) }),
  });
}

export function useResolveAnnotation(solicitationId: string | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, resolved }: { id: string; resolved: boolean }) => {
      const { data: auth } = await supabase.auth.getUser();
      const updates: Partial<AnnotationRow> = {
        is_resolved: resolved,
        resolved_at: resolved ? new Date().toISOString() : null,
        resolved_by: resolved ? auth.user?.id ?? null : null,
      };
      const { error } = await supabase.from("annotations").update(updates).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => solicitationId && qc.invalidateQueries({ queryKey: solKey(solicitationId) }),
  });
}
