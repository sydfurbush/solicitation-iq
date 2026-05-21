import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { SolicitationStage } from "../lib/stage";

interface CreateFinalInput {
  sourceSolicitationId: string;
  newStage: SolicitationStage; // typically 'final' or 'amendment'
  stageLabel?: string | null;
  newTitle?: string | null;
  /** When true, also snapshot the source's current Phase 1 analysis. */
  snapshot?: boolean;
  snapshotLabel?: string | null;
}

/**
 * Calls the SECURITY DEFINER RPC clone_solicitation_for_stage to create a
 * new solicitation linked to the source via parent_solicitation_id, then
 * (optionally) snapshots the source and creates a prior_solicitations link
 * Final -> Pre-Sol so the existing comparison engine can run.
 */
export function useCreateFinalFromPreSol() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: CreateFinalInput) => {
      // 1. Snapshot source if requested
      if (input.snapshot) {
        await snapshotSolicitation(input.sourceSolicitationId, input.snapshotLabel ?? null);
      }

      // 2. Clone via RPC — call as a method so `this` stays bound to the supabase client
      const { data: newId, error } = await supabase.rpc(
        "clone_solicitation_for_stage" as never,
        {
          p_source_id: input.sourceSolicitationId,
          p_new_stage: input.newStage,
          p_stage_label: input.stageLabel ?? null,
          p_new_title: input.newTitle ?? null,
        } as never,
      );
      if (error) throw new Error(error.message);
      if (!newId) throw new Error("Clone failed");

      // 3. Auto-link as prior solicitation so comparison flows work
      await supabase.from("prior_solicitations").insert({
        solicitation_id: newId as string,
        prior_solicitation_id: input.sourceSolicitationId,
        external_reference: "Pre-Solicitation baseline",
      });

      return newId as string;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["solicitations"] });
      qc.invalidateQueries({ queryKey: ["solicitation"] });
      qc.invalidateQueries({ queryKey: ["snapshots"] });
    },
  });
}

async function snapshotSolicitation(solId: string, label: string | null) {
  // Fetch a frozen payload of phase-1 data
  const [sol, reqs, risks, opps, gaps, qs, secs] = await Promise.all([
    supabase.from("solicitations").select("*").eq("id", solId).maybeSingle(),
    supabase.from("requirement_items").select("*").eq("solicitation_id", solId),
    supabase.from("risks").select("*").eq("solicitation_id", solId),
    supabase.from("opportunities").select("*").eq("solicitation_id", solId),
    supabase.from("capability_gaps").select("*").eq("solicitation_id", solId),
    supabase.from("strategic_questions").select("*").eq("solicitation_id", solId),
    supabase.from("section_analyses").select("*").eq("solicitation_id", solId),
  ]);

  const payload = {
    solicitation: sol.data ?? null,
    requirement_items: reqs.data ?? [],
    risks: risks.data ?? [],
    opportunities: opps.data ?? [],
    capability_gaps: gaps.data ?? [],
    strategic_questions: qs.data ?? [],
    section_analyses: secs.data ?? [],
    captured_at: new Date().toISOString(),
  };

  const labelFinal =
    label?.trim() ||
    `Snapshot ${new Date().toLocaleDateString(undefined, { year: "numeric", month: "short", day: "2-digit" })}`;

  const { data: userRes } = await supabase.auth.getUser();
  await supabase.from("solicitation_snapshots").insert({
    solicitation_id: solId,
    snapshot_label: labelFinal,
    payload,
    created_by: userRes?.user?.id ?? null,
  });
}

export function useSnapshots(solicitationId: string | undefined) {
  return useQuery({
    queryKey: ["snapshots", solicitationId],
    enabled: !!solicitationId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("solicitation_snapshots")
        .select("id, snapshot_label, created_at, created_by")
        .eq("solicitation_id", solicitationId!)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });
}

export function useChildSolicitation(parentId: string | undefined) {
  return useQuery({
    queryKey: ["solicitation-child", parentId],
    enabled: !!parentId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("solicitations")
        .select("id, title, stage, stage_label, status, created_at")
        .eq("parent_solicitation_id", parentId!)
        .is("deleted_at", null)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });
}
