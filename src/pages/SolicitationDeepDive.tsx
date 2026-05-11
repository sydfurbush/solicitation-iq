import { useState } from "react";
import { Sparkles, Loader2, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { toast } from "@/hooks/use-toast";
import { useRequirementItems } from "@/features/deepdive/hooks/useRequirementItems";
import { useSectionAnalyses, useAnalyzeSections } from "@/features/deepdive/hooks/useSectionAnalyses";
import { useCapabilityGaps, useAnalyzeGaps, useUpdateGap } from "@/features/deepdive/hooks/useCapabilityGaps";
import { AdvancePhaseButton } from "@/features/phases/components/AdvancePhaseButton";
import { RTMTable } from "@/features/deepdive/components/RTMTable";
import { CapabilitiesProfileCard } from "@/features/deepdive/components/CapabilitiesProfileCard";
import { ExportMenu } from "@/features/exports/components/ExportMenu";
import type { ExportDocument, ExportSection } from "@/features/exports/lib/exporters";

const SEV_COLOR: Record<string, string> = {
  critical: "bg-destructive/15 text-destructive border-destructive/30",
  high: "bg-amber-500/15 text-amber-600 border-amber-500/30",
  medium: "bg-yellow-500/15 text-yellow-700 border-yellow-500/30",
  low: "bg-muted text-muted-foreground",
};

export default function DeepDiveTab({ solicitationId, clientId, currentPhase, solicitationTitle, clientName }: { solicitationId: string; clientId?: string | null; currentPhase: string; solicitationTitle?: string; clientName?: string }) {
  const [tab, setTab] = useState("rtm");
  const { data: items = [] } = useRequirementItems(solicitationId);
  const { data: sections = [] } = useSectionAnalyses(solicitationId);
  const { data: gaps = [] } = useCapabilityGaps(solicitationId);
  const analyzeGaps = useAnalyzeGaps(solicitationId);
  const hasRequirements = items.length > 0;
  const canExport = items.length + sections.length + gaps.length > 0;

  const buildExport = (): ExportDocument | null => {
    if (!canExport) return null;
    const out: ExportSection[] = [];

    if (items.length) {
      out.push({
        heading: "Requirements Traceability Matrix",
        paragraphs: [`${items.length} requirement${items.length === 1 ? "" : "s"}.`],
        table: {
          head: ["#", "Volume / Section", "Shall text", "Owner", "Status"],
          rows: items.map((r) => [
            r.req_number ?? "",
            [r.proposal_volume, r.proposal_section].filter(Boolean).join(" / "),
            r.shall_text ?? "",
            r.compliance_owner ?? "",
            r.status ?? "",
          ]),
        },
      });
    }

    if (sections.length) {
      out.push({
        heading: "Section-by-section analysis",
        children: sections.map((s) => ({
          heading: `${s.section_code} — ${s.section_title ?? "Untitled"}`,
          paragraphs: [
            s.scoring_weight ? `Weight: ${s.scoring_weight}` : "",
            s.summary ?? "",
          ].filter(Boolean),
          bullets: Array.isArray(s.risk_flags) ? (s.risk_flags as string[]) : undefined,
        })),
      });
    }

    if (gaps.length) {
      out.push({
        heading: "Capability gaps",
        table: {
          head: ["Severity", "Type", "Title", "Recommendation", "Resolved", "Description"],
          rows: gaps.map((g) => [
            g.severity ?? "",
            (g.gap_type ?? "").toString().replace("_", " "),
            g.title ?? "",
            (g.recommendation ?? "").toString().replace("_", " "),
            g.is_resolved ? "Yes" : "No",
            g.description ?? "",
          ]),
        },
      });
    }

    return {
      title: "Deep Dive Analysis",
      subtitle: "Requirements, section breakdown, and capability gaps",
      filenameBase: "deep_dive",
      sections: out,
      cover: { clientName, solicitationTitle, phase: currentPhase },
    };
  };

  const autoRunGaps = async () => {
    try {
      const r = await analyzeGaps.mutateAsync();
      toast({ title: "Gaps analyzed", description: `${r.inserted} gaps identified` });
      setTab("gaps");
    } catch (e) {
      toast({
        title: "Auto gap analysis failed",
        description: e instanceof Error ? e.message : String(e),
        variant: "destructive",
      });
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-end">
        <ExportMenu build={buildExport} disabled={!canExport} label="Export deep dive" />
      </div>
      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>
          <TabsTrigger value="rtm">Requirements (RTM)</TabsTrigger>
          <TabsTrigger value="sections">Section analysis</TabsTrigger>
          <TabsTrigger value="gaps">Gaps</TabsTrigger>
        </TabsList>
        <TabsContent value="rtm" className="mt-4">
          <RTMTable solicitationId={solicitationId} onExtracted={autoRunGaps} autoGapsPending={analyzeGaps.isPending} />
        </TabsContent>
        <TabsContent value="sections" className="mt-4"><SectionAccordion solicitationId={solicitationId} /></TabsContent>
        <TabsContent value="gaps" className="mt-4">
          <GapsList
            solicitationId={solicitationId}
            clientId={clientId}
            hasRequirements={hasRequirements}
            externalAnalyze={analyzeGaps}
          />
        </TabsContent>
      </Tabs>
      {currentPhase === "phase_2_deep_dive" && (
        <AdvancePhaseButton solicitationId={solicitationId} currentPhase="phase_2_deep_dive" />
      )}
    </div>
  );
}

function SectionAccordion({ solicitationId }: { solicitationId: string }) {
  const { data: rows = [], isLoading } = useSectionAnalyses(solicitationId);
  const analyze = useAnalyzeSections(solicitationId);
  const run = async () => {
    try {
      const r = await analyze.mutateAsync();
      toast({ title: "Sections analyzed", description: `${r.inserted} sections` });
    } catch (e) {
      toast({ title: "Failed", description: e instanceof Error ? e.message : String(e), variant: "destructive" });
    }
  };
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="text-base">Section-by-section analysis</CardTitle>
        <Button onClick={run} disabled={analyze.isPending}>
          {analyze.isPending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Sparkles className="h-4 w-4 mr-2" />}
          {rows.length ? "Regenerate" : "Analyze sections"}
        </Button>
      </CardHeader>
      <CardContent>
        {isLoading ? <p className="text-sm text-muted-foreground">Loading…</p> :
          rows.length === 0 ? <p className="text-sm text-muted-foreground">No analysis yet.</p> :
          <Accordion type="multiple">
            {rows.map((s) => (
              <AccordionItem key={s.id} value={s.id}>
                <AccordionTrigger className="text-sm">
                  <div className="flex items-center gap-3 text-left">
                    <Badge variant="outline" className="font-mono">{s.section_code}</Badge>
                    <span>{s.section_title ?? "Untitled"}</span>
                    {s.scoring_weight && <Badge variant="secondary">Weight {s.scoring_weight}</Badge>}
                    {Array.isArray(s.risk_flags) && s.risk_flags.length > 0 &&
                      <Badge variant="outline" className="text-amber-600 border-amber-500/30">{s.risk_flags.length} flags</Badge>}
                  </div>
                </AccordionTrigger>
                <AccordionContent className="text-sm space-y-3">
                  <p>{s.summary}</p>
                  {Array.isArray(s.risk_flags) && s.risk_flags.length > 0 && (
                    <div>
                      <p className="text-xs font-medium uppercase tracking-wide mb-1">Risk flags</p>
                      <ul className="list-disc list-inside space-y-1 text-xs">
                        {(s.risk_flags as string[]).map((f, i) => <li key={i}>{f}</li>)}
                      </ul>
                    </div>
                  )}
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        }
      </CardContent>
    </Card>
  );
}

function GapsList({
  solicitationId,
  clientId,
  hasRequirements,
  externalAnalyze,
}: {
  solicitationId: string;
  clientId?: string | null;
  hasRequirements: boolean;
  externalAnalyze: ReturnType<typeof useAnalyzeGaps>;
}) {
  const { data: gaps = [], isLoading } = useCapabilityGaps(solicitationId);
  const update = useUpdateGap(solicitationId);
  const critical = gaps.filter((g) => g.severity === "critical" && !g.is_resolved);
  const lastGapsAt = gaps.reduce<string | null>((acc, g) => {
    const t = g.updated_at ?? g.created_at ?? null;
    if (!acc) return t;
    return t && t > acc ? t : acc;
  }, null);
  const run = async () => {
    try {
      const r = await externalAnalyze.mutateAsync();
      toast({ title: "Gaps analyzed", description: `${r.inserted} gaps identified` });
    } catch (e) {
      toast({ title: "Failed", description: e instanceof Error ? e.message : String(e), variant: "destructive" });
    }
  };

  const disabled = !hasRequirements || externalAnalyze.isPending;
  const button = (
    <Button onClick={run} disabled={disabled}>
      {externalAnalyze.isPending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Sparkles className="h-4 w-4 mr-2" />}
      {gaps.length ? "Regenerate gaps" : "Generate gaps"}
    </Button>
  );

  return (
    <div className="space-y-4">
      <CapabilitiesProfileCard clientId={clientId} gapsUpdatedAt={lastGapsAt} />
      {critical.length > 0 && (
        <div className="border border-destructive/30 bg-destructive/5 rounded-md p-4 flex items-start gap-3">
          <AlertTriangle className="h-5 w-5 text-destructive mt-0.5" />
          <div>
            <p className="font-medium text-destructive">No-bid trigger</p>
            <p className="text-xs text-muted-foreground">{critical.length} unresolved critical gap(s) detected.</p>
          </div>
        </div>
      )}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle className="text-base">Capability gaps</CardTitle>
            {!hasRequirements && (
              <p className="text-xs text-muted-foreground mt-1">
                Extract the RTM first — gap analysis needs the requirements list.
              </p>
            )}
          </div>
          {!hasRequirements ? (
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild><span>{button}</span></TooltipTrigger>
                <TooltipContent>Run RTM extraction first</TooltipContent>
              </Tooltip>
            </TooltipProvider>
          ) : button}
        </CardHeader>
        <CardContent>
          {isLoading ? <p className="text-sm text-muted-foreground">Loading…</p> :
            gaps.length === 0 ? <p className="text-sm text-muted-foreground">No gaps identified yet. {hasRequirements ? "Click \"Generate gaps\" to compare requirements against client capabilities." : "Extract the RTM to enable gap analysis."}</p> :
            <ul className="space-y-3">
              {gaps.map((g) => (
                <li key={g.id} className="border rounded-md p-3">
                  <div className="flex items-center gap-2 flex-wrap mb-1">
                    <Badge className={SEV_COLOR[g.severity] ?? ""} variant="outline">{g.severity}</Badge>
                    <Badge variant="secondary" className="capitalize">{g.gap_type.replace("_", " ")}</Badge>
                    {g.recommendation && <Badge variant="outline" className="capitalize">{g.recommendation.replace("_", " ")}</Badge>}
                    <span className="font-medium text-sm">{g.title}</span>
                  </div>
                  {g.description && <p className="text-xs text-muted-foreground">{g.description}</p>}
                  {g.client_note && <p className="text-xs text-muted-foreground mt-1 italic">{g.client_note}</p>}
                  <div className="mt-2">
                    <label className="text-xs text-muted-foreground">
                      <input
                        type="checkbox"
                        defaultChecked={g.is_resolved}
                        onChange={(e) => update.mutate({ id: g.id, patch: { is_resolved: e.target.checked } })}
                        className="mr-1"
                      />
                      Resolved
                    </label>
                  </div>
                </li>
              ))}
            </ul>
          }
        </CardContent>
      </Card>
    </div>
  );
}
