import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useUser } from "@/features/auth/hooks/useUser";
import { DEFAULT_BRAND, type BrandTemplate } from "../types";

const KEY = (orgId?: string) => ["org-brand", orgId];

export function useBrand() {
  const { organization } = useUser();
  const orgId = organization?.id;

  const query = useQuery({
    queryKey: KEY(orgId),
    enabled: !!orgId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("organizations")
        .select("id, name, logo_url, settings")
        .eq("id", orgId!)
        .maybeSingle();
      if (error) throw error;
      const settings = (data?.settings as Record<string, unknown> | null) ?? {};
      const brand = (settings.brand as BrandTemplate | undefined) ?? {};
      const merged: BrandTemplate = {
        ...DEFAULT_BRAND,
        firmName: brand.firmName ?? data?.name ?? undefined,
        logoUrl: brand.logoUrl ?? data?.logo_url ?? undefined,
        ...brand,
      };
      return { brand: merged, organizationName: data?.name ?? null };
    },
  });

  return {
    brand: query.data?.brand ?? DEFAULT_BRAND,
    organizationName: query.data?.organizationName ?? null,
    isLoading: query.isLoading,
    refetch: query.refetch,
  };
}

export function useUpdateBrand() {
  const { organization } = useUser();
  const qc = useQueryClient();
  const orgId = organization?.id;

  return useMutation({
    mutationFn: async (patch: Partial<BrandTemplate>) => {
      if (!orgId) throw new Error("No organization");
      const { data: existing, error: readErr } = await supabase
        .from("organizations")
        .select("settings")
        .eq("id", orgId)
        .maybeSingle();
      if (readErr) throw readErr;
      const settings = (existing?.settings as Record<string, unknown> | null) ?? {};
      const currentBrand = (settings.brand as BrandTemplate | undefined) ?? {};
      const nextBrand: BrandTemplate = { ...currentBrand, ...patch };
      // strip undefined so we don't store noise
      const cleaned: Record<string, unknown> = {};
      Object.entries(nextBrand).forEach(([k, v]) => {
        if (v !== undefined && v !== "") cleaned[k] = v;
      });
      const { error } = await supabase
        .from("organizations")
        .update({ settings: { ...settings, brand: cleaned } as never })
        .eq("id", orgId);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: KEY(orgId) });
    },
  });
}

export async function uploadBrandLogo(file: File, orgId: string): Promise<string> {
  const ext = file.name.split(".").pop()?.toLowerCase() || "png";
  const path = `${orgId}/logo-${Date.now()}.${ext}`;
  const { error } = await supabase.storage
    .from("brand-assets")
    .upload(path, file, { cacheControl: "3600", upsert: true, contentType: file.type });
  if (error) throw error;
  const { data } = supabase.storage.from("brand-assets").getPublicUrl(path);
  return data.publicUrl;
}

/** Convert a remote logo URL to a base64 data URL so jspdf/docx can embed it. */
export async function fetchLogoAsDataUrl(url: string): Promise<{ dataUrl: string; mime: string } | null> {
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    const blob = await res.blob();
    const mime = blob.type || "image/png";
    const dataUrl = await new Promise<string>((resolve, reject) => {
      const r = new FileReader();
      r.onload = () => resolve(r.result as string);
      r.onerror = reject;
      r.readAsDataURL(blob);
    });
    return { dataUrl, mime };
  } catch {
    return null;
  }
}
