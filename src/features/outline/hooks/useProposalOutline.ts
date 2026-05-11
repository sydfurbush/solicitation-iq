import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";

export type ProposalOutline = Database["public"]["Tables"]["proposal_outlines"]["Row"];
export type OutlineNode = Database["public"]["Tables"]["outline_nodes"]["Row"];
export type OutlineNodeUpdate = Database["public"]["Tables"]["outline_nodes"]["Update"];

const outlineKey = (id: string) => ["proposal-outline", id] as const;
const nodesKey = (id: string) => ["outline-nodes", id] as const;

export function useActiveOutline(solicitationId: string | undefined) {
  return useQuery({
    queryKey: solicitationId ? outlineKey(solicitationId) : ["proposal-outline", "none"],
    enabled: !!solicitationId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("proposal_outlines")
        .select("*")
        .eq("solicitation_id", solicitationId!)
        .eq("is_active", true)
        .order("version", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return (data ?? null) as ProposalOutline | null;
    },
  });
}

export function useOutlineNodes(outlineId: string | undefined) {
  return useQuery({
    queryKey: outlineId ? nodesKey(outlineId) : ["outline-nodes", "none"],
    enabled: !!outlineId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("outline_nodes")
        .select("*")
        .eq("outline_id", outlineId!)
        .order("sort_order", { ascending: true });
      if (error) throw error;
      return (data ?? []) as OutlineNode[];
    },
  });
}

export function useGenerateOutline(solicitationId: string | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      if (!solicitationId) throw new Error("Missing solicitationId");
      const { data, error } = await supabase.functions.invoke("generate-outline", {
        body: { solicitationId },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      return data;
    },
    onSuccess: () => {
      if (!solicitationId) return;
      qc.invalidateQueries({ queryKey: outlineKey(solicitationId) });
      qc.invalidateQueries({ queryKey: ["outline-nodes"] });
    },
  });
}

export function useUpdateOutlineNode(outlineId: string | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { id: string; patch: OutlineNodeUpdate }) => {
      const { error } = await supabase
        .from("outline_nodes")
        .update(input.patch)
        .eq("id", input.id);
      if (error) throw error;
    },
    onSuccess: () => {
      if (!outlineId) return;
      qc.invalidateQueries({ queryKey: nodesKey(outlineId) });
    },
  });
}

export function useDeleteOutlineNode(outlineId: string | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("outline_nodes").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      if (!outlineId) return;
      qc.invalidateQueries({ queryKey: nodesKey(outlineId) });
    },
  });
}
