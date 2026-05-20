import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useCompileProposal, useProposalPackages, downloadPackage } from "../hooks/useProposalDrafts";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Download, Loader2, Package, AlertTriangle, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import { formatDistanceToNow } from "date-fns";
import { supabase } from "@/integrations/supabase/client";
import { useFormatProfiles } from "@/features/formatProfiles/hooks/useFormatProfiles";

interface Props { solicitationId: string }

const NONE = "__org_default__";

function useSolicitationFormatProfile(solicitationId: string) {
  return useQuery({
    queryKey: ["sol-format-profile", solicitationId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("solicitations")
        .select("format_profile_id")
        .eq("id", solicitationId)
        .maybeSingle();
      if (error) throw error;
      return data?.format_profile_id ?? null;
    },
  });
}

function useSetSolicitationFormatProfile(solicitationId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string | null) => {
      const { error } = await supabase
        .from("solicitations")
        .update({ format_profile_id: id })
        .eq("id", solicitationId);
      if (error) throw error;
      return id;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["sol-format-profile", solicitationId] }),
  });
}

export function CompilePanel({ solicitationId }: Props) {
  const { data: packages = [] } = useProposalPackages(solicitationId);
  const { data: profiles = [] } = useFormatProfiles();
  const { data: selectedProfileId } = useSolicitationFormatProfile(solicitationId);
  const setProfile = useSetSolicitationFormatProfile(solicitationId);
  const compile = useCompileProposal(solicitationId);

  const defaultFederal = profiles.find((p) => p.is_default && p.vertical === "federal");
  const effectiveProfile = selectedProfileId
    ? profiles.find((p) => p.id === selectedProfileId)
    : defaultFederal;

  const onCompile = async () => {
    try {
      const r = await compile.mutateAsync();
      toast.success(`Compiled ${r?.packages?.length ?? 0} volume(s)`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Compile failed");
    }
  };

  const onProfileChange = (value: string) => {
    const id = value === NONE ? null : value;
    setProfile.mutate(id, {
      onSuccess: () => toast.success(id ? "Format profile updated" : "Reset to org default"),
      onError: (e: Error) => toast.error(e.message),
    });
  };

  return (
    <div className="space-y-4">
      <Card className="p-4 space-y-4">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <div className="text-sm font-semibold">Proposal Compiler</div>
            <div className="text-xs text-muted-foreground">
              Compiles each volume into a Word document with title page, TOC, footers, and per-buyer formatting.
            </div>
          </div>
          <Button onClick={onCompile} disabled={compile.isPending}>
            {compile.isPending ? <Loader2 className="h-4 w-4 mr-1.5 animate-spin" /> : <Package className="h-4 w-4 mr-1.5" />}
            Compile Proposal
          </Button>
        </div>

        <div className="grid sm:grid-cols-[1fr_auto] gap-3 items-end border-t pt-3">
          <div className="space-y-1.5">
            <Label className="text-xs">Format profile</Label>
            <Select value={selectedProfileId ?? NONE} onValueChange={onProfileChange} disabled={setProfile.isPending}>
              <SelectTrigger className="h-9">
                <SelectValue placeholder="Org default" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={NONE}>
                  Org default{defaultFederal ? ` — ${defaultFederal.name}` : ""}
                </SelectItem>
                {profiles.map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.name} <span className="text-muted-foreground">· {p.vertical}</span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {effectiveProfile && (
            <div className="text-xs text-muted-foreground sm:text-right">
              <div>{effectiveProfile.font} · {effectiveProfile.size_pt}pt · {effectiveProfile.margins_in}" margins</div>
              <div>Line spacing {effectiveProfile.line_spacing}x</div>
            </div>
          )}
        </div>
      </Card>



      <Card className="p-4">
        <div className="text-sm font-semibold mb-3">Compiled packages</div>
        {!packages.length && <div className="text-xs text-muted-foreground">No compilations yet. Click "Compile Proposal" to generate volume Word documents.</div>}
        <ul className="space-y-2">
          {packages.map((p) => {
            const report = (p.pre_flight_report ?? {}) as { issues?: Array<{ severity: string; message: string }>; totalPages?: number; pageLimit?: number | null };
            const issues = report.issues ?? [];
            return (
              <li key={p.id} className="border rounded-md p-3">
                <div className="flex items-center justify-between gap-3 flex-wrap">
                  <div className="min-w-0">
                    <div className="text-sm font-medium flex items-center gap-2">
                      {p.pre_flight_pass ? <CheckCircle2 className="h-4 w-4 text-emerald-600" /> : <AlertTriangle className="h-4 w-4 text-amber-600" />}
                      {p.volume ?? p.kind}
                      <Badge variant="outline" className="text-[10px]">{p.kind}</Badge>
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {report.totalPages ?? 0} pp{report.pageLimit ? ` / ${report.pageLimit} limit` : ""} · {(p.byte_size ?? 0).toLocaleString()} bytes · {formatDistanceToNow(new Date(p.created_at), { addSuffix: true })}
                    </div>
                  </div>
                  <Button size="sm" variant="outline" onClick={() => downloadPackage(p).catch((e) => toast.error(e.message))}>
                    <Download className="h-3.5 w-3.5 mr-1.5" />Download
                  </Button>
                </div>
                {issues.length > 0 && (
                  <ul className="mt-2 space-y-1">
                    {issues.map((i, idx) => (
                      <li key={idx} className="text-xs flex items-start gap-1.5">
                        <span className={i.severity === "error" ? "text-destructive" : "text-amber-600"}>●</span>
                        <span>{i.message}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </li>
            );
          })}
        </ul>
      </Card>
    </div>
  );
}
