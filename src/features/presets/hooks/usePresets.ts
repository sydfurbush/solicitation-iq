import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export interface PresetContent {
  naics_codes?: string[];
  psc_codes?: string[];
  set_asides?: string[];
  agencies_focus?: string[];
  contract_vehicles?: string[];
  compliance_frameworks?: string[];
  discriminators?: { title: string; evidence: string; proof_point: string }[];
  acronym_glossary?: Record<string, string>;
  always_flag?: { rule: string; reason: string }[];
  tone_voice?: string;
  reading_level?: number;
  keywords?: string[];
  [k: string]: unknown;
}

export interface PresetRow {
  id: string;
  organization_id: string | null;
  key: string;
  label: string;
  description: string | null;
  family: string;
  is_builtin: boolean;
  current_version_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface PresetVersion {
  id: string;
  preset_id: string;
  version: number;
  content: PresetContent;
  change_note: string | null;
  created_at: string;
  created_by: string | null;
}

export function usePresets() {
  return useQuery({
    queryKey: ["lens-presets"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("lens_presets" as never)
        .select("*")
        .is("deleted_at", null)
        .order("is_builtin", { ascending: false })
        .order("label");
      if (error) throw error;
      return (data ?? []) as unknown as PresetRow[];
    },
  });
}

export function usePresetVersions(presetId: string | null) {
  return useQuery({
    queryKey: ["lens-preset-versions", presetId],
    enabled: !!presetId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("lens_preset_versions" as never)
        .select("*")
        .eq("preset_id", presetId!)
        .order("version", { ascending: false });
      if (error) throw error;
      return (data ?? []) as unknown as PresetVersion[];
    },
  });
}

export function usePresetCurrentContent(preset: PresetRow | null) {
  return useQuery({
    queryKey: ["lens-preset-content", preset?.current_version_id],
    enabled: !!preset?.current_version_id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("lens_preset_versions" as never)
        .select("*")
        .eq("id", preset!.current_version_id!)
        .maybeSingle();
      if (error) throw error;
      return data as unknown as PresetVersion | null;
    },
  });
}

async function getOrgId() {
  const { data: u } = await supabase.auth.getUser();
  if (!u?.user) throw new Error("Not authenticated");
  const { data, error } = await supabase
    .from("users")
    .select("organization_id")
    .eq("id", u.user.id)
    .maybeSingle();
  if (error) throw error;
  return data?.organization_id ?? null;
}

export function useCreatePreset() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (args: {
      key: string;
      label: string;
      description?: string;
      family?: string;
      content: PresetContent;
    }) => {
      const orgId = await getOrgId();
      if (!orgId) throw new Error("No organization");
      const { data: u } = await supabase.auth.getUser();
      const { data: preset, error: e1 } = await supabase
        .from("lens_presets" as never)
        .insert({
          organization_id: orgId,
          key: args.key,
          label: args.label,
          description: args.description ?? null,
          family: args.family ?? "federal",
          is_builtin: false,
          created_by: u.user?.id,
        } as never)
        .select()
        .single();
      if (e1) throw e1;
      const presetRow = preset as unknown as PresetRow;
      const { data: v, error: e2 } = await supabase
        .from("lens_preset_versions" as never)
        .insert({
          preset_id: presetRow.id,
          version: 1,
          content: args.content,
          change_note: "Initial",
          created_by: u.user?.id,
        } as never)
        .select()
        .single();
      if (e2) throw e2;
      const versionRow = v as unknown as PresetVersion;
      const { error: e3 } = await supabase
        .from("lens_presets" as never)
        .update({ current_version_id: versionRow.id } as never)
        .eq("id", presetRow.id);
      if (e3) throw e3;
      return presetRow;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["lens-presets"] });
      toast.success("Preset created");
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useSavePresetVersion() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (args: {
      preset: PresetRow;
      content: PresetContent;
      label?: string;
      description?: string;
      change_note?: string;
    }) => {
      const { data: versions, error: ev } = await supabase
        .from("lens_preset_versions" as never)
        .select("version")
        .eq("preset_id", args.preset.id)
        .order("version", { ascending: false })
        .limit(1);
      if (ev) throw ev;
      const next = ((versions?.[0] as { version?: number } | undefined)?.version ?? 0) + 1;

      const { data: u } = await supabase.auth.getUser();
      const { data: v, error: e1 } = await supabase
        .from("lens_preset_versions" as never)
        .insert({
          preset_id: args.preset.id,
          version: next,
          content: args.content,
          change_note: args.change_note ?? null,
          created_by: u.user?.id,
        } as never)
        .select()
        .single();
      if (e1) throw e1;
      const versionRow = v as unknown as PresetVersion;
      const updates: Record<string, unknown> = { current_version_id: versionRow.id };
      if (args.label) updates.label = args.label;
      if (args.description !== undefined) updates.description = args.description;
      const { error: e2 } = await supabase
        .from("lens_presets" as never)
        .update(updates as never)
        .eq("id", args.preset.id);
      if (e2) throw e2;
      return versionRow;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["lens-presets"] });
      qc.invalidateQueries({ queryKey: ["lens-preset-versions"] });
      qc.invalidateQueries({ queryKey: ["lens-preset-content"] });
      toast.success("New version saved");
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useRollbackPreset() {
  const qc = useQueryClient();
  const save = useSavePresetVersion();
  return useMutation({
    mutationFn: async (args: { preset: PresetRow; version: PresetVersion }) => {
      return save.mutateAsync({
        preset: args.preset,
        content: args.version.content,
        change_note: `Rolled back to v${args.version.version}`,
      });
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["lens-presets"] }),
  });
}

export function useClonePreset() {
  const qc = useQueryClient();
  const create = useCreatePreset();
  return useMutation({
    mutationFn: async (args: { source: PresetRow; sourceContent: PresetContent; newKey: string; newLabel: string }) => {
      return create.mutateAsync({
        key: args.newKey,
        label: args.newLabel,
        description: args.source.description ?? undefined,
        family: args.source.family,
        content: args.sourceContent,
      });
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["lens-presets"] }),
  });
}

export function useDeletePreset() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (presetId: string) => {
      const { error } = await supabase
        .from("lens_presets" as never)
        .update({ deleted_at: new Date().toISOString() } as never)
        .eq("id", presetId);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["lens-presets"] });
      toast.success("Preset deleted");
    },
    onError: (e: Error) => toast.error(e.message),
  });
}
