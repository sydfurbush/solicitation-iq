import { Fragment, useMemo, useState } from "react";
import { useActiveOutline, useOutlineNodes, type OutlineNode } from "@/features/outline/hooks/useProposalOutline";
import { useRequirementItems, useUpdateRequirement, type RequirementItem, type RequirementUpdate } from "@/features/deepdive/hooks/useRequirementItems";
import { groupRequirements, rollupGroup, matchesMatrixFilters, matrixCsv, WORKFLOW_LABELS, type MatrixFilters, type RequirementGroup } from "@/features/deepdive/utils/matrix";
import { ImportMatrixButton } from "@/features/deepdive/components/ImportMatrixButton";
import { RegroupButton } from "@/features/deepdive/components/RegroupButton";
import { useProposalDrafts } from "../hooks/useProposalDrafts";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Download, MoreHorizontal, Link2, Flag, Pencil } from "lucide-react";
import { toast } from "sonner";
import { useAssignRequirement, useCanEditRequirementLinks, useUnassignRequirement } from "@/features/outline/hooks/useRequirementLinks";
import { SectionPickerDialog, sectionLabel } from "@/features/outline/components/SectionPickerDialog";
import { useAuth } from "@/features/auth/hooks/useAuth";

interface Props { solicitationId: string; initialGapsOnly?: boolean }
function Choice({ label, value, options, onChange, disabled = false }: { label: string; value: string; options: Record<string, string>; onChange: (v: string) => void; disabled?: boolean }) {
  return <Select value={value} onValueChange={onChange} disabled={disabled}><SelectTrigger aria-label={label} className="h-8 w-auto min-w-36 max-w-full text-xs"><SelectValue /></SelectTrigger><SelectContent>{Object.entries(options).map(([key, name]) => <SelectItem key={key} value={key}>{name}</SelectItem>)}</SelectContent></Select>;
}
export function ComplianceMatrix({ solicitationId, initialGapsOnly = false }: Props) {
  const { data: outline } = useActiveOutline(solicitationId);
  const { data: nodes = [] } = useOutlineNodes(outline?.id);
  const { data: requirements = [], isLoading, error } = useRequirementItems(solicitationId);
  const { data: drafts = [] } = useProposalDrafts(solicitationId);
  const { user } = useAuth();
  const canEdit = useCanEditRequirementLinks();
  const update = useUpdateRequirement(solicitationId);
  const assign = useAssignRequirement();
  const unassign = useUnassignRequirement();
  const [filters, setFilters] = useState<MatrixFilters>({ applicability: "proposal", area: "all", status: "all", criticality: "all", clarification: false, gapsOnly: initialGapsOnly });
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [picking, setPicking] = useState<{ req: RequirementItem; currentNodeId: string | null } | null>(null);
  const [editing, setEditing] = useState<RequirementItem | null>(null);
  const [patch, setPatch] = useState<RequirementUpdate>({});
  const groups = useMemo(() => groupRequirements(requirements), [requirements]);
  const rows = useMemo(() => groups.map(group => ({ group, rollup: rollupGroup(group, nodes, drafts) })), [groups, nodes, drafts]);
  const visible = rows.filter(r => matchesMatrixFilters(r.group, filters, r.rollup.gap));
  const applicable = rows.filter(r => filters.applicability === "all" || r.group.master.applicability === filters.applicability);
  const gaps = applicable.filter(r => r.rollup.gap).length;
  const canAssign = canEdit && !!outline && nodes.length > 0;
  const save = async (req: RequirementItem, fields: RequirementUpdate) => {
    if (!canEdit) return false;
    try { await update.mutateAsync({ id: req.id, patch: fields }); return true; }
    catch (e) { toast.error(e instanceof Error ? e.message : "Could not save requirement"); return false; }
  };
  const onPick = async (node: OutlineNode) => {
    if (!picking) return;
    try { await assign.mutateAsync({ requirementId: picking.req.id, nodeId: node.id }); toast.success(`${picking.req.req_number} linked to ${sectionLabel(node)}`); setPicking(null); }
    catch (e) { toast.error(e instanceof Error ? e.message : "Could not link requirement"); }
  };
  const remove = async (req: RequirementItem) => {
    if (!outline) return;
    try { await unassign.mutateAsync({ requirementId: req.id, outlineId: outline.id }); toast.success("Requirement removed from section"); }
    catch (e) { toast.error(e instanceof Error ? e.message : "Could not remove requirement"); }
  };
  const exportCsv = () => {
    const url = URL.createObjectURL(new Blob([matrixCsv(visible.map(r => r.group), nodes, drafts)], { type: "text/csv;charset=utf-8" }));
    const a = document.createElement("a"); a.href = url; a.download = `compliance-matrix-${solicitationId}.csv`; a.click(); URL.revokeObjectURL(url);
  };
  const renderRow = (req: RequirementItem, group: RequirementGroup, detail = false) => {
    const rollup = rollupGroup(detail ? { master: req, details: [] } : group, nodes, drafts);
    const ownNode = nodes.find(n => n.linked_requirement_ids?.includes(req.id));
    return <tr key={req.id} className={detail ? "border-t bg-muted/30" : "border-t"}>
      <td className={`p-2 align-top font-mono ${detail ? "pl-6" : ""}`}><span>{req.req_number}</span>{!detail && group.details.length > 0 && <Button size="sm" variant="ghost" className="block h-7 text-xs" aria-expanded={expanded.has(req.id)} onClick={() => setExpanded(prev => { const next = new Set(prev); next.has(req.id) ? next.delete(req.id) : next.add(req.id); return next; })}>{expanded.has(req.id) ? "−" : "+"}{group.details.length} detail</Button>}</td>
      <td className="p-2 align-top">{req.area || "—"}</td><td className="p-2 align-top">{req.requirement_type || "—"}</td><td className="p-2 align-top">{req.source_section || "—"}</td>
      <td className="p-2 align-top min-w-64 max-w-md"><div className="whitespace-pre-wrap">{req.shall_text}</div><Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => { setEditing(req); setPatch({ response_evidence: req.response_evidence, action_needed: req.action_needed, criticality: req.criticality, compliance_owner: req.compliance_owner, needs_clarification: req.needs_clarification, verified_at: req.verified_at, verified_by: req.verified_by }); }}><Pencil className="mr-1 h-3 w-3" />Details</Button></td>
      <td className="p-2 align-top min-w-44">{rollup.nodes.length > 0 ? rollup.nodes.map(n => <div key={n.id}>{[n.volume, n.section_number, n.title].filter(Boolean).join(" · ")}</div>) : <div>{req.proposal_section || "—"}</div>}{canAssign && !ownNode && <Button size="sm" variant="outline" className="mt-1 h-7 text-xs" onClick={() => setPicking({ req, currentNodeId: null })}><Link2 className="mr-1 h-3 w-3" />Assign to section</Button>}</td>
      <td className="p-2 align-top"><Choice label={`Status ${req.req_number}`} value={req.workflow_status} options={WORKFLOW_LABELS} disabled={!canEdit || update.isPending} onChange={value => void save(req, { workflow_status: value })} /></td>
      <td className="p-2 align-top"><Badge variant={req.criticality === "high" ? "destructive" : "outline"} className="capitalize">{req.criticality || "—"}</Badge></td>
      <td className="p-2 align-top">{req.compliance_owner || "—"}</td>
      <td className="p-2 align-top">{req.needs_clarification && <Flag aria-label="Clarification needed" className="h-4 w-4 text-destructive" />} {req.verified_at && <Badge variant="outline">Verified</Badge>}</td>
      <td className="p-2 align-top"><Badge variant={rollup.gap ? "destructive" : "outline"}>{rollup.cited ? "Cited" : rollup.drafted ? "Drafted, not cited" : rollup.linked ? "Pending" : "Gap"}</Badge></td>
      <td className="p-2 align-top">{canAssign && ownNode && <DropdownMenu><DropdownMenuTrigger asChild><Button size="icon" variant="ghost" className="h-7 w-7" aria-label={`Actions ${req.req_number}`}><MoreHorizontal className="h-4 w-4" /></Button></DropdownMenuTrigger><DropdownMenuContent><DropdownMenuItem onClick={() => setPicking({ req, currentNodeId: ownNode.id })}>Move to another section</DropdownMenuItem><DropdownMenuItem className="text-destructive" onClick={() => void remove(req)}>Remove from section</DropdownMenuItem></DropdownMenuContent></DropdownMenu>}</td>
    </tr>;
  };
  return <section className="space-y-3">
    <div className="flex flex-wrap items-center justify-between gap-3"><div><h3 className="text-sm font-semibold">Live Compliance Matrix</h3><p className="text-xs text-muted-foreground">{applicable.length} requirements · <span className={gaps ? "text-destructive" : ""}>{gaps} gaps</span> · {applicable.filter(r => r.group.master.needs_clarification).length} need clarification · {applicable.filter(r => r.group.master.workflow_status === "ready").length} ready</p></div><div className="flex flex-wrap gap-2"><ImportMatrixButton solicitationId={solicitationId} /><RegroupButton solicitationId={solicitationId} /><Button size="sm" variant="outline" onClick={exportCsv} disabled={!visible.length}><Download className="mr-1 h-4 w-4" />Export CSV</Button></div></div>
    <div className="flex flex-wrap items-center gap-2">
      <Choice label="Applicability" value={filters.applicability} options={{ proposal: "Proposal requirements", post_award: "Post-award terms", all: "All" }} onChange={v => setFilters(f => ({ ...f, applicability: v }))} />
      <Choice label="Area" value={filters.area} options={{ all: "All areas", ...Object.fromEntries([...new Set(requirements.map(r => r.area).filter((a): a is string => !!a))].map(a => [a, a])) }} onChange={v => setFilters(f => ({ ...f, area: v }))} />
      <Choice label="Status filter" value={filters.status} options={{ all: "All statuses", ...WORKFLOW_LABELS }} onChange={v => setFilters(f => ({ ...f, status: v }))} />
      <Choice label="Criticality filter" value={filters.criticality} options={{ all: "All criticalities", high: "High", medium: "Medium", low: "Low" }} onChange={v => setFilters(f => ({ ...f, criticality: v }))} />
      <Label className="flex items-center gap-2 text-xs"><Checkbox checked={filters.clarification} onCheckedChange={v => setFilters(f => ({ ...f, clarification: v === true }))} />Needs clarification</Label>
      <Label className="flex items-center gap-2 text-xs"><Switch checked={filters.gapsOnly} onCheckedChange={v => setFilters(f => ({ ...f, gapsOnly: v }))} />Show gaps only</Label>
    </div>
    {error && <p role="alert" className="text-destructive">{error.message}</p>}
    <div className="overflow-auto max-h-[65vh] rounded-md border"><table className="w-full text-xs"><thead className="sticky top-0 bg-muted"><tr>{["ID", "Area", "Type", "Reference", "Requirement", "Proposal location", "Status", "Criticality", "Owner", "Clarification", "Link / draft / cited", ""].map((label, i) => <th key={i} className="p-2 text-left font-medium whitespace-nowrap">{label}</th>)}</tr></thead><tbody>{visible.map(({ group }) => <Fragment key={group.master.id}>{renderRow(group.master, group)}{expanded.has(group.master.id) && group.details.map(req => renderRow(req, group, true))}</Fragment>)}{!visible.length && <tr><td colSpan={12} className="p-6 text-center text-muted-foreground">{isLoading ? "Loading…" : "No requirements match these filters."}</td></tr>}</tbody></table></div>
    <SectionPickerDialog open={!!picking} onOpenChange={open => { if (!open) setPicking(null); }} nodes={nodes} currentNodeId={picking?.currentNodeId} onPick={onPick} />
    <Sheet open={!!editing} onOpenChange={open => { if (!open) setEditing(null); }}><SheetContent className="overflow-y-auto"><SheetHeader><SheetTitle>{editing?.req_number}</SheetTitle><SheetDescription>{editing?.shall_text}</SheetDescription></SheetHeader><div className="mt-5 space-y-4">
      <Label className="block space-y-2"><span>Response / evidence</span><Textarea disabled={!canEdit} value={patch.response_evidence || ""} onChange={e => setPatch(p => ({ ...p, response_evidence: e.target.value }))} /></Label>
      <Label className="block space-y-2"><span>Action needed</span><Textarea disabled={!canEdit} value={patch.action_needed || ""} onChange={e => setPatch(p => ({ ...p, action_needed: e.target.value }))} /></Label>
      <Label className="block space-y-2"><span>Owner</span><Input disabled={!canEdit} value={patch.compliance_owner || ""} onChange={e => setPatch(p => ({ ...p, compliance_owner: e.target.value }))} /></Label>
      <Choice label="Criticality" disabled={!canEdit} value={patch.criticality || "none"} options={{ none: "Not set", high: "High", medium: "Medium", low: "Low" }} onChange={v => setPatch(p => ({ ...p, criticality: v === "none" ? null : v }))} />
      <Label className="flex items-center gap-2"><Checkbox disabled={!canEdit} checked={patch.needs_clarification === true} onCheckedChange={v => setPatch(p => ({ ...p, needs_clarification: v === true }))} />Needs clarification</Label>
      <Label className="flex items-center gap-2"><Checkbox disabled={!canEdit || !user} checked={!!patch.verified_at} onCheckedChange={v => { if (!user) return; setPatch(p => ({ ...p, verified_at: v === true ? new Date().toISOString() : null, verified_by: v === true ? user.id : null })); }} />Verified</Label>
      {canEdit && <Button disabled={update.isPending} onClick={async () => { if (editing && await save(editing, patch)) { toast.success("Requirement saved"); setEditing(null); } }}>Save</Button>}
    </div></SheetContent></Sheet>
  </section>;
}
