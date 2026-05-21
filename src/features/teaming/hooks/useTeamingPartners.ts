import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";

export type TeamingPartner = Database["public"]["Tables"]["solicitation_teaming_partners"]["Row"];
export type TeamingPartnerInsert = Database["public"]["Tables"]["solicitation_teaming_partners"]["Insert"];
export type TeamingPartnerUpdate = Database["public"]["Tables"]["solicitation_teaming_partners"]["Update"];
export type TeamingAttachment = Database["public"]["Tables"]["solicitation_teaming_attachments"]["Row"];

const partnersKey = (id: string) => ["teaming-partners", id] as const;
const attachmentsKey = (id: string) => ["teaming-attachments", id] as const;

export function useTeamingPartners(solicitationId: string | undefined) {
  return useQuery({
    queryKey: solicitationId ? partnersKey(solicitationId) : ["teaming-partners", "none"],
    enabled: !!solicitationId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("solicitation_teaming_partners")
        .select("*")
        .eq("solicitation_id", solicitationId!)
        .order("sort_order", { ascending: true })
        .order("created_at", { ascending: true });
      if (error) throw error;
      return (data ?? []) as TeamingPartner[];
    },
  });
}

export function useCreateTeamingPartner(solicitationId: string | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: Partial<TeamingPartnerInsert> & { name: string }) => {
      if (!solicitationId) throw new Error("Missing solicitationId");
      const { data: u } = await supabase.auth.getUser();
      const { data, error } = await supabase
        .from("solicitation_teaming_partners")
        .insert({
          solicitation_id: solicitationId,
          name: input.name,
          role: input.role ?? "sub",
          set_asides: input.set_asides ?? [],
          naics_codes: input.naics_codes ?? [],
          workshare_pct: input.workshare_pct ?? null,
          scope_summary: input.scope_summary ?? null,
          agreement_status: input.agreement_status ?? "none",
          poc_name: input.poc_name ?? null,
          poc_email: input.poc_email ?? null,
          poc_phone: input.poc_phone ?? null,
          clearance_level: input.clearance_level ?? null,
          cleared_staff_count: input.cleared_staff_count ?? null,
          notes: input.notes ?? null,
          linked_client_id: input.linked_client_id ?? null,
          sort_order: input.sort_order ?? 0,
          created_by: u.user?.id ?? null,
        } satisfies TeamingPartnerInsert)
        .select("*")
        .single();
      if (error) throw error;
      return data as TeamingPartner;
    },
    onSuccess: () => {
      if (!solicitationId) return;
      qc.invalidateQueries({ queryKey: partnersKey(solicitationId) });
    },
  });
}

export function useUpdateTeamingPartner(solicitationId: string | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { id: string; patch: TeamingPartnerUpdate }) => {
      const { error } = await supabase
        .from("solicitation_teaming_partners")
        .update(input.patch)
        .eq("id", input.id);
      if (error) throw error;
    },
    onSuccess: () => {
      if (!solicitationId) return;
      qc.invalidateQueries({ queryKey: partnersKey(solicitationId) });
    },
  });
}

export function useDeleteTeamingPartner(solicitationId: string | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("solicitation_teaming_partners").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      if (!solicitationId) return;
      qc.invalidateQueries({ queryKey: partnersKey(solicitationId) });
    },
  });
}

export function useTeamingAttachments(solicitationId: string | undefined) {
  return useQuery({
    queryKey: solicitationId ? attachmentsKey(solicitationId) : ["teaming-attachments", "none"],
    enabled: !!solicitationId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("solicitation_teaming_attachments")
        .select("*")
        .eq("solicitation_id", solicitationId!)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as TeamingAttachment[];
    },
  });
}

export function useUploadTeamingAttachment(solicitationId: string | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { partnerId: string; file: File }) => {
      if (!solicitationId) throw new Error("Missing solicitationId");
      const { data: u } = await supabase.auth.getUser();
      const safeName = input.file.name.replace(/[^A-Za-z0-9._-]+/g, "_");
      const path = `teaming/${solicitationId}/${input.partnerId}/${Date.now()}_${safeName}`;
      const up = await supabase.storage
        .from("solicitation-documents")
        .upload(path, input.file, { upsert: false, contentType: input.file.type || undefined });
      if (up.error) throw up.error;
      const { error } = await supabase.from("solicitation_teaming_attachments").insert({
        partner_id: input.partnerId,
        solicitation_id: solicitationId,
        file_path: path,
        file_name: input.file.name,
        mime_type: input.file.type || null,
        byte_size: input.file.size,
        uploaded_by: u.user?.id ?? null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      if (!solicitationId) return;
      qc.invalidateQueries({ queryKey: attachmentsKey(solicitationId) });
    },
  });
}

export function useDeleteTeamingAttachment(solicitationId: string | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { id: string; filePath: string }) => {
      await supabase.storage.from("solicitation-documents").remove([input.filePath]);
      const { error } = await supabase
        .from("solicitation_teaming_attachments")
        .delete()
        .eq("id", input.id);
      if (error) throw error;
    },
    onSuccess: () => {
      if (!solicitationId) return;
      qc.invalidateQueries({ queryKey: attachmentsKey(solicitationId) });
    },
  });
}

export async function downloadTeamingAttachment(filePath: string, fileName: string) {
  const { data, error } = await supabase.storage
    .from("solicitation-documents")
    .createSignedUrl(filePath, 60);
  if (error || !data?.signedUrl) throw error ?? new Error("Could not create download link");
  const a = document.createElement("a");
  a.href = data.signedUrl;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  a.remove();
}
