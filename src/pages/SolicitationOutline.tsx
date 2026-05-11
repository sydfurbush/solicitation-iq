import { Sparkles, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { toast } from "@/hooks/use-toast";
import { useActiveOutline, useOutlineNodes, useGenerateOutline } from "@/features/outline/hooks/useProposalOutline";
import { AdvancePhaseButton } from "@/features/phases/components/AdvancePhaseButton";
import { ExportMenu } from "@/features/exports/components/ExportMenu";
import type { ExportDocument } from "@/features/exports/lib/exporters";

export default function SolicitationOutline({ solicitationId, currentPhase, solicitationTitle, clientName }: { solicitationId: string; currentPhase: string; solicitationTitle?: string; clientName?: string }) {
  const { data: outline, isLoading } = useActiveOutline(solicitationId);
  const { data: nodes = [] } = useOutlineNodes(outline?.id);
  const gen = useGenerateOutline(solicitationId);

  const buildExport = (): ExportDocument | null => {
    if (!outline || nodes.length === 0) return null;
    return {
      title: outline.title ?? "Proposal outline",
      subtitle: `Version ${outline.version} · ${nodes.length} nodes`,
      filenameBase: "proposal_outline",
      sections: [
        {
          heading: "Outline",
          table: {
            head: ["#", "Volume", "Title", "Pages", "L Reference", "Notes"],
            rows: nodes.map((n) => [
              n.section_number ?? "",
              n.volume ?? "",
              n.title ?? "",
              n.page_allocation ? String(n.page_allocation) : "",
              n.source_l_reference ?? "",
              n.notes ?? "",
            ]),
          },
        },
      ],
      cover: { clientName, solicitationTitle, phase: currentPhase },
    };
  };

  const run = async () => {
    try {
      const r = await gen.mutateAsync();
      toast({ title: "Outline generated", description: `${r.inserted} nodes` });
    } catch (e) {
      toast({ title: "Failed", description: e instanceof Error ? e.message : String(e), variant: "destructive" });
    }
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle className="text-base">{outline?.title ?? "Proposal outline"}</CardTitle>
            {outline && <p className="text-xs text-muted-foreground mt-1">v{outline.version} · {nodes.length} nodes</p>}
          </div>
          <div className="flex gap-2">
            <ExportMenu build={buildExport} disabled={!outline || nodes.length === 0} label="Export outline" />
            <Button onClick={run} disabled={gen.isPending}>
              {gen.isPending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Sparkles className="h-4 w-4 mr-2" />}
              {outline ? "Regenerate" : "Generate outline"}
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? <p className="text-sm text-muted-foreground">Loading…</p> :
            !outline || nodes.length === 0 ? (
              <p className="text-sm text-muted-foreground">No outline yet. Make sure the RTM is built first, then click "Generate outline".</p>
            ) : (
              <ul className="space-y-1">
                {nodes.map((n) => (
                  <li
                    key={n.id}
                    className="flex items-start gap-3 py-2 border-b last:border-0"
                    style={{ paddingLeft: `${(n.section_number?.split(".").length ?? 1) * 12}px` }}
                  >
                    {n.section_number && <span className="font-mono text-xs text-muted-foreground min-w-[60px]">{n.section_number}</span>}
                    <div className="flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        {n.volume && <Badge variant="outline" className="text-[10px]">{n.volume}</Badge>}
                        <span className="font-medium text-sm">{n.title}</span>
                        {n.page_allocation && <Badge variant="secondary">{n.page_allocation}p</Badge>}
                        {n.linked_requirement_ids?.length ? (
                          <Badge variant="outline" className="text-[10px]">{n.linked_requirement_ids.length} reqs</Badge>
                        ) : null}
                      </div>
                      {n.source_l_reference && <p className="text-xs text-muted-foreground">→ {n.source_l_reference}</p>}
                      {n.notes && <p className="text-xs text-muted-foreground mt-1">{n.notes}</p>}
                    </div>
                  </li>
                ))}
              </ul>
            )
          }
        </CardContent>
      </Card>
      {currentPhase === "phase_3_outline" && (
        <AdvancePhaseButton solicitationId={solicitationId} currentPhase="phase_3_outline" />
      )}
    </div>
  );
}
