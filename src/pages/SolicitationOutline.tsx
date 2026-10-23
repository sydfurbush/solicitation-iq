import { useMemo, useState } from "react";
import { Sparkles, Loader2, FileSearch, Link2, Wand2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { toast } from "@/hooks/use-toast";
import { useActiveOutline, useOutlineNodes, useGenerateOutline, useRelinkOutlineSources } from "@/features/outline/hooks/useProposalOutline";
import { AdvancePhaseButton } from "@/features/phases/components/AdvancePhaseButton";
import { ExportMenu } from "@/features/exports/components/ExportMenu";
import { ExportHistoryButton } from "@/features/exports/components/ExportHistoryButton";
import type { ExportDocument } from "@/features/exports/lib/exporters";
import { useFormatProfileForSolicitation } from "@/features/formatProfiles/hooks/useFormatProfileForSolicitation";
import { FormatProfilePanel } from "@/features/outline/components/FormatProfilePanel";
import { DeriveFormatDialog } from "@/features/formatProfiles/components/DeriveFormatDialog";
import { ToastAction } from "@/components/ui/toast";
import { useSearchParams } from "react-router-dom";
import { useRequirementItems } from "@/features/deepdive/hooks/useRequirementItems";
import { useCanEditRequirementLinks } from "@/features/outline/hooks/useRequirementLinks";
import { SectionRequirementsSheet } from "@/features/outline/components/SectionRequirementsSheet";
import type { OutlineNode } from "@/features/outline/hooks/useProposalOutline";

type SourceSection = {
  document_id: string | null;
  document_name: string | null;
  section_number: string | null;
  section_title: string | null;
  page_start: number | null;
};

export default function SolicitationOutline({ solicitationId, currentPhase, solicitationTitle, clientName, solicitationNumber }: { solicitationId: string; currentPhase: string; solicitationTitle?: string; clientName?: string; solicitationNumber?: string | null }) {
  const { data: outline, isLoading } = useActiveOutline(solicitationId);
  const { data: nodes = [] } = useOutlineNodes(outline?.id);
  const gen = useGenerateOutline(solicitationId);
  const relink = useRelinkOutlineSources(solicitationId);
  const { data: formatData } = useFormatProfileForSolicitation(solicitationId);
  const [deriveOpen, setDeriveOpen] = useState(false);
  const { data: requirements = [] } = useRequirementItems(solicitationId);
  const canEditLinks = useCanEditRequirementLinks();
  const [reqNode, setReqNode] = useState<OutlineNode | null>(null);
  const [, setSearchParams] = useSearchParams();

  const limits = (formatData?.profile?.volume_page_limits ?? {}) as Record<string, number | null>;

  // Sum of page_allocation per volume from the current outline
  const totalsByVolume = useMemo(() => {
    const m = new Map<string, number>();
    for (const n of nodes) {
      const v = n.volume ?? "";
      if (!v) continue;
      const segs = n.section_number?.split(".").length ?? 1;
      if (segs <= 1) continue; // skip volume-row itself
      m.set(v, (m.get(v) ?? 0) + (n.page_allocation ?? 0));
    }
    return m;
  }, [nodes]);

  const runRelink = async () => {
    try {
      const r = await relink.mutateAsync();
      toast({ title: "Sources relinked", description: `${r.updated} of ${r.total} nodes matched to documents` });
    } catch (e) {
      toast({ title: "Failed", description: e instanceof Error ? e.message : String(e), variant: "destructive" });
    }
  };

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
      const unplaced = Array.isArray(r?.unplaced_requirements) ? r.unplaced_requirements : [];
      if (unplaced.length > 0) {
        toast({
          title: `${unplaced.length} of ${r.total_requirements ?? unplaced.length} requirements weren't placed in a section`,
          action: (
            <ToastAction altText="Review gaps" onClick={() => {
              const next = new URLSearchParams();
              next.set("tab", "phase-3");
              next.set("step", "compliance");
              next.set("gaps", "1");
              setSearchParams(next);
            }}>Review gaps</ToastAction>
          ),
        });
      }
    } catch (e) {
      toast({ title: "Failed", description: e instanceof Error ? e.message : String(e), variant: "destructive" });
    }
  };

  return (
    <div className="space-y-6">
      {formatData?.profile ? (
        <FormatProfilePanel profile={formatData.profile} isDefault={formatData.isDefault} />
      ) : (
        <Card className="border-dashed">
          <CardContent className="pt-4 pb-4 flex items-center justify-between gap-3 flex-wrap">
            <p className="text-sm text-muted-foreground">No format profile linked to this solicitation. Derive one from Section L so the outline can budget pages per volume.</p>
            <Button size="sm" variant="outline" onClick={() => setDeriveOpen(true)}>
              <Wand2 className="h-4 w-4 mr-2" /> Derive format
            </Button>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle className="text-base">{outline?.title ?? "Proposal outline"}</CardTitle>
            {outline && <p className="text-xs text-muted-foreground mt-1">v{outline.version} · {nodes.length} nodes</p>}
          </div>
          <div className="flex gap-2 flex-wrap">
            <Button variant="outline" onClick={() => setDeriveOpen(true)} title="Derive format profile from Section L">
              <Wand2 className="h-4 w-4 mr-2" /> Derive format
            </Button>
            <ExportMenu build={buildExport} disabled={!outline || nodes.length === 0} label="Export outline" solicitationId={solicitationId} kind="outline" />
            <ExportHistoryButton solicitationId={solicitationId} kind="outline" />
            {outline && nodes.length > 0 && (
              <Button variant="outline" onClick={runRelink} disabled={relink.isPending} title="Match outline nodes to source documents">
                {relink.isPending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Link2 className="h-4 w-4 mr-2" />}
                Re-link sources
              </Button>
            )}
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
                {nodes.map((n) => {
                  const isVolumeRow = (n.section_number?.split(".").length ?? 1) <= 1 || (n.section_number?.endsWith(".0") ?? false);
                  const volLimit = n.volume ? limits[n.volume] : undefined;
                  const volTotal = n.volume ? totalsByVolume.get(n.volume) ?? 0 : 0;
                  const overrun = typeof volLimit === "number" && volTotal > volLimit;
                  return (
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
                          {isVolumeRow && typeof volLimit === "number" && (
                            <Badge variant={overrun ? "destructive" : "outline"} className="text-[10px]">
                              {volTotal} / {volLimit}p
                            </Badge>
                          )}
                          {n.linked_requirement_ids?.length || canEditLinks ? (
                            <button type="button" onClick={() => setReqNode(n)} aria-label={`Requirements for ${n.title}`}>
                              <Badge variant="outline" className="text-[10px] hover:bg-accent cursor-pointer">{n.linked_requirement_ids?.length ?? 0} reqs</Badge>
                            </button>
                          ) : null}
                          {(() => {
                            const sources = ((n as unknown as { source_document_sections?: SourceSection[] }).source_document_sections ?? []) as SourceSection[];
                            if (!sources.length) return null;
                            return (
                              <Popover>
                                <PopoverTrigger asChild>
                                  <button className="inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-md border border-border hover:bg-accent transition-colors">
                                    <FileSearch className="h-3 w-3" />
                                    {sources.length} source{sources.length > 1 ? "s" : ""}
                                  </button>
                                </PopoverTrigger>
                                <PopoverContent align="start" className="w-96">
                                  <p className="text-xs font-semibold mb-2">Where this came from</p>
                                  <ul className="space-y-2">
                                    {sources.map((s, i) => (
                                      <li key={i} className="text-xs border-b last:border-0 pb-2 last:pb-0">
                                        <div className="font-medium">{s.section_number ? `${s.section_number} ` : ""}{s.section_title ?? "Untitled section"}</div>
                                        <div className="text-muted-foreground mt-0.5">
                                          {s.document_name ?? "Unknown document"}
                                          {s.page_start != null ? ` · p. ${s.page_start}` : ""}
                                        </div>
                                      </li>
                                    ))}
                                  </ul>
                                  <p className="text-[10px] text-muted-foreground mt-3">Open the Documents tab to read the full passages.</p>
                                </PopoverContent>
                              </Popover>
                            );
                          })()}
                        </div>
                        {n.source_l_reference && <p className="text-xs text-muted-foreground">→ {n.source_l_reference}</p>}
                        {n.notes && <p className="text-xs text-muted-foreground mt-1">{n.notes}</p>}
                      </div>
                    </li>
                  );
                })}
              </ul>
            )
          }
        </CardContent>
      </Card>
      {currentPhase === "phase_3_outline" && (
        <AdvancePhaseButton solicitationId={solicitationId} currentPhase="phase_3_outline" />
      )}

      <DeriveFormatDialog
        solicitationId={solicitationId}
        solicitationNumber={solicitationNumber}
        open={deriveOpen}
        onOpenChange={setDeriveOpen}
      />
    </div>
  );
}
