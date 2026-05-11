import { useState } from "react";
import { Sparkles, Loader2, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "@/hooks/use-toast";
import { useRequirementItems, useExtractRequirements, useUpdateRequirement } from "@/features/deepdive/hooks/useRequirementItems";
import { useSectionAnalyses, useAnalyzeSections } from "@/features/deepdive/hooks/useSectionAnalyses";
import { useCapabilityGaps, useAnalyzeGaps, useUpdateGap } from "@/features/deepdive/hooks/useCapabilityGaps";
import { AdvancePhaseButton } from "@/features/phases/components/AdvancePhaseButton";

const SEV_COLOR: Record<string, string> = {
  critical: "bg-destructive/15 text-destructive border-destructive/30",
  high: "bg-amber-500/15 text-amber-600 border-amber-500/30",
  medium: "bg-yellow-500/15 text-yellow-700 border-yellow-500/30",
  low: "bg-muted text-muted-foreground",
};

export default function DeepDiveTab({ solicitationId, currentPhase }: { solicitationId: string; currentPhase: string }) {
  return (
    <div className="space-y-6">
      <Tabs defaultValue="rtm">
        <TabsList>
          <TabsTrigger value="rtm">Requirements (RTM)</TabsTrigger>
          <TabsTrigger value="sections">Section analysis</TabsTrigger>
          <TabsTrigger value="gaps">Gaps</TabsTrigger>
        </TabsList>
        <TabsContent value="rtm" className="mt-4"><RTMTable solicitationId={solicitationId} /></TabsContent>
        <TabsContent value="sections" className="mt-4"><SectionAccordion solicitationId={solicitationId} /></TabsContent>
        <TabsContent value="gaps" className="mt-4"><GapsList solicitationId={solicitationId} /></TabsContent>
      </Tabs>
      {currentPhase === "phase_2_deep_dive" && (
        <AdvancePhaseButton solicitationId={solicitationId} currentPhase="phase_2_deep_dive" />
      )}
    </div>
  );
}

function RTMTable({ solicitationId }: { solicitationId: string }) {
  const { data: items = [], isLoading } = useRequirementItems(solicitationId);
  const extract = useExtractRequirements(solicitationId);
  const update = useUpdateRequirement(solicitationId);
  const [filter, setFilter] = useState("");

  const filtered = items.filter((r) => {
    if (!filter) return true;
    const q = filter.toLowerCase();
    return (
      r.req_number.toLowerCase().includes(q) ||
      r.shall_text.toLowerCase().includes(q) ||
      (r.source_section ?? "").toLowerCase().includes(q)
    );
  });

  const run = async (regenerate = false) => {
    try {
      const r = await extract.mutateAsync({ regenerate });
      toast({ title: "RTM extracted", description: `${r.inserted} requirements added` });
    } catch (e) {
      toast({ title: "Failed", description: e instanceof Error ? e.message : String(e), variant: "destructive" });
    }
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-4">
        <div>
          <CardTitle className="text-base">Requirements Traceability Matrix</CardTitle>
          <p className="text-xs text-muted-foreground mt-1">{items.length} requirements</p>
        </div>
        <div className="flex gap-2">
          <Input placeholder="Filter…" value={filter} onChange={(e) => setFilter(e.target.value)} className="w-64" />
          <Button onClick={() => run(items.length > 0)} disabled={extract.isPending}>
            {extract.isPending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Sparkles className="h-4 w-4 mr-2" />}
            {items.length > 0 ? "Regenerate" : "Extract requirements"}
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <p className="text-sm text-muted-foreground">Loading…</p>
        ) : items.length === 0 ? (
          <p className="text-sm text-muted-foreground">No requirements yet. Click "Extract requirements" to build the RTM from your documents.</p>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-24">#</TableHead>
                  <TableHead>Shall statement</TableHead>
                  <TableHead className="w-28">Section</TableHead>
                  <TableHead className="w-40">Owner</TableHead>
                  <TableHead className="w-40">Proposal Vol/Sec</TableHead>
                  <TableHead className="w-32">Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((r) => (
                  <TableRow key={r.id}>
                    <TableCell className="font-mono text-xs">{r.req_number}</TableCell>
                    <TableCell className="text-xs">{r.shall_text}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">{r.source_section ?? "—"}</TableCell>
                    <TableCell>
                      <Input
                        defaultValue={r.compliance_owner ?? ""}
                        className="h-7 text-xs"
                        placeholder="Owner"
                        onBlur={(e) => {
                          if (e.target.value !== (r.compliance_owner ?? "")) {
                            update.mutate({ id: r.id, patch: { compliance_owner: e.target.value || null } });
                          }
                        }}
                      />
                    </TableCell>
                    <TableCell>
                      <Input
                        defaultValue={[r.proposal_volume, r.proposal_section].filter(Boolean).join(" / ")}
                        className="h-7 text-xs"
                        placeholder="Vol / Sec"
                        onBlur={(e) => {
                          const [vol, sec] = e.target.value.split("/").map((s) => s.trim());
                          update.mutate({ id: r.id, patch: { proposal_volume: vol || null, proposal_section: sec || null } });
                        }}
                      />
                    </TableCell>
                    <TableCell>
                      <Select
                        defaultValue={r.status ?? "open"}
                        onValueChange={(v) => update.mutate({ id: r.id, patch: { status: v as "open" | "in_review" | "covered" | "waived" } })}
                      >
                        <SelectTrigger className="h-7 text-xs"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="open">Open</SelectItem>
                          <SelectItem value="in_review">In review</SelectItem>
                          <SelectItem value="covered">Covered</SelectItem>
                          <SelectItem value="waived">Waived</SelectItem>
                        </SelectContent>
                      </Select>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
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

function GapsList({ solicitationId }: { solicitationId: string }) {
  const { data: gaps = [], isLoading } = useCapabilityGaps(solicitationId);
  const analyze = useAnalyzeGaps(solicitationId);
  const update = useUpdateGap(solicitationId);
  const critical = gaps.filter((g) => g.severity === "critical" && !g.is_resolved);
  const run = async () => {
    try {
      const r = await analyze.mutateAsync();
      toast({ title: "Gaps analyzed", description: `${r.inserted} gaps identified` });
    } catch (e) {
      toast({ title: "Failed", description: e instanceof Error ? e.message : String(e), variant: "destructive" });
    }
  };
  return (
    <div className="space-y-4">
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
          <CardTitle className="text-base">Capability gaps</CardTitle>
          <Button onClick={run} disabled={analyze.isPending}>
            {analyze.isPending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Sparkles className="h-4 w-4 mr-2" />}
            {gaps.length ? "Regenerate" : "Analyze gaps"}
          </Button>
        </CardHeader>
        <CardContent>
          {isLoading ? <p className="text-sm text-muted-foreground">Loading…</p> :
            gaps.length === 0 ? <p className="text-sm text-muted-foreground">No gaps identified yet. Run the RTM extraction first, then click "Analyze gaps".</p> :
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
