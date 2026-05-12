import { useEffect, useState } from "react";
import { Loader2, Upload, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { toast } from "@/hooks/use-toast";
import { useBrand, useUpdateBrand, uploadBrandLogo } from "../hooks/useBrand";
import { useUser } from "@/features/auth/hooks/useUser";
import type { BrandTemplate } from "../types";

const HEX_RE = /^#([0-9a-fA-F]{6}|[0-9a-fA-F]{3})$/;

export function BrandTab() {
  const { brand, isLoading } = useBrand();
  const { organization, role } = useUser();
  const update = useUpdateBrand();
  const isAdmin = role === "owner" || role === "admin";

  const [draft, setDraft] = useState<BrandTemplate>(brand);
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    setDraft(brand);
  }, [brand]);

  const set = <K extends keyof BrandTemplate>(k: K, v: BrandTemplate[K]) =>
    setDraft((d) => ({ ...d, [k]: v }));

  const onUpload = async (file: File) => {
    if (!organization?.id) return;
    if (file.size > 2 * 1024 * 1024) {
      toast({ title: "Logo too large", description: "Please upload an image under 2 MB.", variant: "destructive" });
      return;
    }
    try {
      setUploading(true);
      const url = await uploadBrandLogo(file, organization.id);
      set("logoUrl", url);
      toast({ title: "Logo uploaded", description: "Don't forget to save your changes." });
    } catch (e) {
      toast({ title: "Upload failed", description: e instanceof Error ? e.message : String(e), variant: "destructive" });
    } finally {
      setUploading(false);
    }
  };

  const onSave = async () => {
    if (draft.primaryColor && !HEX_RE.test(draft.primaryColor)) {
      toast({ title: "Invalid primary color", description: "Use a hex value like #1F3A8A.", variant: "destructive" });
      return;
    }
    if (draft.accentColor && !HEX_RE.test(draft.accentColor)) {
      toast({ title: "Invalid accent color", description: "Use a hex value like #FFFFFF.", variant: "destructive" });
      return;
    }
    try {
      await update.mutateAsync(draft);
      toast({ title: "Brand saved", description: "Future exports will use these settings." });
    } catch (e) {
      toast({ title: "Save failed", description: e instanceof Error ? e.message : String(e), variant: "destructive" });
    }
  };

  if (isLoading) {
    return <p className="text-sm text-muted-foreground">Loading brand…</p>;
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Brand template for exports</CardTitle>
        <p className="text-xs text-muted-foreground">
          Applied to PDF and Word exports across Deep Dive, Outline, and Win Themes.
        </p>
      </CardHeader>
      <CardContent className="space-y-6">
        {!isAdmin && (
          <p className="text-xs rounded-md border border-amber-500/40 bg-amber-500/10 text-amber-700 px-3 py-2">
            Only organization admins can change brand settings. You can preview but cannot save.
          </p>
        )}

        {/* Logo */}
        <div className="space-y-2">
          <Label>Logo</Label>
          <div className="flex items-center gap-4">
            <div className="h-20 w-40 rounded-md border bg-muted/30 flex items-center justify-center overflow-hidden">
              {draft.logoUrl ? (
                <img src={draft.logoUrl} alt="Brand logo" className="h-full w-full object-contain" />
              ) : (
                <span className="text-xs text-muted-foreground">No logo</span>
              )}
            </div>
            <div className="flex flex-col gap-2">
              <label className="inline-flex">
                <input
                  type="file"
                  accept="image/png,image/jpeg,image/svg+xml"
                  className="hidden"
                  disabled={!isAdmin || uploading}
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) onUpload(f);
                    e.target.value = "";
                  }}
                />
                <Button asChild variant="outline" size="sm" disabled={!isAdmin || uploading}>
                  <span>
                    {uploading ? (
                      <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
                    ) : (
                      <Upload className="h-3.5 w-3.5 mr-1.5" />
                    )}
                    Upload logo
                  </span>
                </Button>
              </label>
              {draft.logoUrl && isAdmin && (
                <Button variant="ghost" size="sm" onClick={() => set("logoUrl", undefined)}>
                  <X className="h-3.5 w-3.5 mr-1.5" /> Remove
                </Button>
              )}
              <p className="text-[11px] text-muted-foreground">PNG/JPG/SVG, under 2 MB. Transparent PNG recommended.</p>
            </div>
          </div>
        </div>

        {/* Colors */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="brand-primary">Primary color</Label>
            <div className="flex gap-2 items-center">
              <input
                id="brand-primary-picker"
                type="color"
                value={draft.primaryColor ?? "#283C5A"}
                disabled={!isAdmin}
                onChange={(e) => set("primaryColor", e.target.value.toUpperCase())}
                className="h-10 w-12 rounded border bg-background cursor-pointer"
              />
              <Input
                id="brand-primary"
                value={draft.primaryColor ?? ""}
                disabled={!isAdmin}
                onChange={(e) => set("primaryColor", e.target.value)}
                placeholder="#283C5A"
              />
            </div>
            <p className="text-xs text-muted-foreground">Used for cover accent, table headers, and footer rule.</p>
          </div>
          <div className="space-y-2">
            <Label htmlFor="brand-accent">Header text color</Label>
            <div className="flex gap-2 items-center">
              <input
                type="color"
                value={draft.accentColor ?? "#FFFFFF"}
                disabled={!isAdmin}
                onChange={(e) => set("accentColor", e.target.value.toUpperCase())}
                className="h-10 w-12 rounded border bg-background cursor-pointer"
              />
              <Input
                id="brand-accent"
                value={draft.accentColor ?? ""}
                disabled={!isAdmin}
                onChange={(e) => set("accentColor", e.target.value)}
                placeholder="#FFFFFF"
              />
            </div>
            <p className="text-xs text-muted-foreground">Text rendered on the primary-colored bands.</p>
          </div>
        </div>

        {/* Text */}
        <div className="space-y-2">
          <Label htmlFor="brand-firm">Firm name</Label>
          <Input
            id="brand-firm"
            value={draft.firmName ?? ""}
            disabled={!isAdmin}
            onChange={(e) => set("firmName", e.target.value)}
            placeholder={organization?.name ?? "Your firm"}
          />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="brand-header">Page header text</Label>
            <Input
              id="brand-header"
              value={draft.headerText ?? ""}
              disabled={!isAdmin}
              onChange={(e) => set("headerText", e.target.value)}
              placeholder="CONFIDENTIAL · ACME PROPOSALS"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="brand-footer">Page footer text</Label>
            <Input
              id="brand-footer"
              value={draft.footerText ?? ""}
              disabled={!isAdmin}
              onChange={(e) => set("footerText", e.target.value)}
              placeholder="© 2026 Acme Federal · acme.com"
            />
          </div>
        </div>

        {/* Toggles */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="flex items-center justify-between rounded-md border p-3">
            <div>
              <Label htmlFor="brand-pages">Show "Page X of Y"</Label>
              <p className="text-xs text-muted-foreground">Right side of every body footer.</p>
            </div>
            <Switch
              id="brand-pages"
              checked={!!draft.showPageNumbers}
              disabled={!isAdmin}
              onCheckedChange={(v) => set("showPageNumbers", v)}
            />
          </div>
          <div className="flex items-center justify-between rounded-md border p-3">
            <div>
              <Label htmlFor="brand-cover-logo">Show logo on cover</Label>
              <p className="text-xs text-muted-foreground">Centers logo above the title.</p>
            </div>
            <Switch
              id="brand-cover-logo"
              checked={!!draft.showLogoOnCover}
              disabled={!isAdmin}
              onCheckedChange={(v) => set("showLogoOnCover", v)}
            />
          </div>
        </div>

        <div className="flex justify-end">
          <Button onClick={onSave} disabled={!isAdmin || update.isPending}>
            {update.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Save brand
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
