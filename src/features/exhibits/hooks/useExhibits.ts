import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";

export type Exhibit = Database["public"]["Tables"]["proposal_exhibits"]["Row"];
export type ExhibitKind = Database["public"]["Enums"]["exhibit_kind"];
export type ExhibitPlacement = Database["public"]["Enums"]["exhibit_placement"];
export type ExhibitStatus = Database["public"]["Enums"]["exhibit_status"];

const BUCKET = "proposal-exhibits";
const key = (solId: string) => ["proposal-exhibits", solId] as const;

export function useExhibits(solicitationId: string | undefined) {
  return useQuery({
    queryKey: solicitationId ? key(solicitationId) : ["proposal-exhibits", "none"],
    enabled: !!solicitationId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("proposal_exhibits")
        .select("*")
        .eq("solicitation_id", solicitationId!)
        .order("appendix_code", { ascending: true, nullsFirst: true })
        .order("sort_order", { ascending: true })
        .order("created_at", { ascending: true });
      if (error) throw error;
      return (data ?? []) as Exhibit[];
    },
  });
}

export type ExhibitInput = Partial<Database["public"]["Tables"]["proposal_exhibits"]["Insert"]> & {
  title: string;
};

export function useCreateExhibit(solicitationId: string, organizationId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: ExhibitInput) => {
      const payload = {
        ...input,
        solicitation_id: solicitationId,
        organization_id: organizationId,
      } as Database["public"]["Tables"]["proposal_exhibits"]["Insert"];
      const { data, error } = await supabase
        .from("proposal_exhibits")
        .insert(payload)
        .select()
        .single();
      if (error) throw error;
      return data as Exhibit;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: key(solicitationId) }),
  });
}

export function useUpdateExhibit(solicitationId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      id,
      patch,
    }: {
      id: string;
      patch: Partial<Database["public"]["Tables"]["proposal_exhibits"]["Update"]>;
    }) => {
      const { data, error } = await supabase
        .from("proposal_exhibits")
        .update(patch)
        .eq("id", id)
        .select()
        .single();
      if (error) throw error;
      return data as Exhibit;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: key(solicitationId) }),
  });
}

export function useDeleteExhibit(solicitationId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (ex: Exhibit) => {
      if (ex.file_path) {
        await supabase.storage.from(BUCKET).remove([ex.file_path]).catch(() => null);
      }
      const { error } = await supabase.from("proposal_exhibits").delete().eq("id", ex.id);
      if (error) throw error;
      return ex;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: key(solicitationId) }),
  });
}

export function useUploadExhibitFile(solicitationId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      exhibit,
      file,
    }: {
      exhibit: Exhibit;
      file: File;
    }) => {
      const safe = file.name.replace(/[^a-zA-Z0-9._-]+/g, "_");
      const path = `${exhibit.organization_id}/${solicitationId}/${exhibit.id}/${safe}`;
      const { error: upErr } = await supabase.storage.from(BUCKET).upload(path, file, {
        cacheControl: "3600",
        upsert: true,
        contentType: file.type || undefined,
      });
      if (upErr) throw upErr;
      const patch = {
        file_path: path,
        file_name: file.name,
        file_type: file.type || null,
        file_size: file.size,
        status:
          exhibit.status === "placeholder"
            ? ("in_progress" as ExhibitStatus)
            : exhibit.status,
      };
      const { data, error } = await supabase
        .from("proposal_exhibits")
        .update(patch)
        .eq("id", exhibit.id)
        .select()
        .single();
      if (error) throw error;
      return data as Exhibit;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: key(solicitationId) }),
  });
}

export async function getExhibitSignedUrl(path: string, expiresIn = 600): Promise<string> {
  const { data, error } = await supabase.storage.from(BUCKET).createSignedUrl(path, expiresIn);
  if (error) throw error;
  return data.signedUrl;
}

export function useSolicitationAppendixSettings(solicitationId: string | undefined) {
  return useQuery({
    queryKey: ["sol-appendix", solicitationId],
    enabled: !!solicitationId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("solicitations")
        .select("compile_appendix_volume, appendix_volume_name")
        .eq("id", solicitationId!)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });
}

export function useUpdateAppendixSettings(solicitationId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (patch: { compile_appendix_volume?: boolean; appendix_volume_name?: string }) => {
      const { error } = await supabase.from("solicitations").update(patch).eq("id", solicitationId);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["sol-appendix", solicitationId] }),
  });
}
