import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type RevisionKind = "pre_sol" | "amendment" | "final" | "draft" | "other";

export type Revision = {
  id: string;
  solicitation_id: string;
  label: string;
  kind: RevisionKind;
  sequence: number;
  source: string;
  sam_notice_id: string | null;
  received_at: string;
  notes: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
};

const key = (solicitationId: string) => ["solicitation-revisions", solicitationId] as const;

export function useRevisions(solicitationId: string | undefined) {
  return useQuery({
    queryKey: solicitationId ? key(solicitationId) : ["solicitation-revisions", "none"],
    enabled: !!solicitationId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("solicitation_revisions" as never)
        .select("*")
        .eq("solicitation_id", solicitationId!)
        .order("sequence", { ascending: true });
      if (error) throw error;
      return (data ?? []) as unknown as Revision[];
    },
  });
}

export type CreateRevisionInput = {
  label: string;
  kind: RevisionKind;
  source?: string;
  sam_notice_id?: string | null;
  received_at?: string | null;
  notes?: string | null;
};

export function useCreateRevision(solicitationId: string | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: CreateRevisionInput) => {
      if (!solicitationId) throw new Error("Missing solicitationId");
      // Determine next sequence
      const { data: existing } = await supabase
        .from("solicitation_revisions" as never)
        .select("sequence")
        .eq("solicitation_id", solicitationId)
        .order("sequence", { ascending: false })
        .limit(1);
      const nextSeq = (((existing as { sequence: number }[] | null) ?? [])[0]?.sequence ?? -1) + 1;

      const { data: userData } = await supabase.auth.getUser();
      const { data, error } = await (supabase
        .from("solicitation_revisions" as never) as unknown as {
          insert: (v: Record<string, unknown>) => { select: () => { single: () => Promise<{ data: unknown; error: { message: string } | null }> } };
        })
        .insert({
          solicitation_id: solicitationId,
          label: input.label,
          kind: input.kind,
          sequence: nextSeq,
          source: input.source ?? "manual",
          sam_notice_id: input.sam_notice_id ?? null,
          received_at: input.received_at ?? new Date().toISOString(),
          notes: input.notes ?? null,
          created_by: userData?.user?.id ?? null,
        })
        .select()
        .single();
      if (error) throw error;
      return data as unknown as Revision;
    },
    onSuccess: () => solicitationId && qc.invalidateQueries({ queryKey: key(solicitationId) }),
  });
}

export function useDeleteRevision(solicitationId: string | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("solicitation_revisions" as never).delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => solicitationId && qc.invalidateQueries({ queryKey: key(solicitationId) }),
  });
}
