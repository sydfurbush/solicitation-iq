import { useCompileProposal, useProposalPackages, downloadPackage } from "../hooks/useProposalDrafts";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Download, Loader2, Package, AlertTriangle, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import { formatDistanceToNow } from "date-fns";

interface Props { solicitationId: string }

export function CompilePanel({ solicitationId }: Props) {
  const { data: packages = [] } = useProposalPackages(solicitationId);
  const compile = useCompileProposal(solicitationId);

  const onCompile = async () => {
    try {
      const r = await compile.mutateAsync();
      toast.success(`Compiled ${r?.packages?.length ?? 0} volume(s)`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Compile failed");
    }
  };

  return (
    <div className="space-y-4">
      <Card className="p-4">
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
