import { useMemo, useState } from "react";
import { useActiveOutline, useOutlineNodes, type OutlineNode } from "@/features/outline/hooks/useProposalOutline";
import { useRequirementItems, type RequirementItem } from "@/features/deepdive/hooks/useRequirementItems";
import { useProposalDrafts } from "../hooks/useProposalDrafts";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Download, MoreHorizontal, Link2 } from "lucide-react";
import { toast } from "sonner";
import { isRequirementCited } from "../../../../supabase/functions/_shared/requirementLinks";
import { useAssignRequirement, useCanEditRequirementLinks, useUnassignRequirement } from "@/features/outline/hooks/useRequirementLinks";
import { SectionPickerDialog, sectionLabel } from "@/features/outline/components/SectionPickerDialog";

interface Props { solicitationId: string; initialGapsOnly?: boolean }

export function ComplianceMatrix({ solicitationId, initialGapsOnly = false }: Props) {
  const { data: outline } = useActiveOutline(solicitationId);
  const { data: nodes = [] } = useOutlineNodes(outline?.id);
  const { data: requirements = [] } = useRequirementItems(solicitationId);
  const { data: drafts = [] } = useProposalDrafts(solicitationId);
  const canEdit = useCanEditRequirementLinks();
  const assign = useAssignRequirement();
  const unassign = useUnassignRequirement();
  const [gapsOnly, setGapsOnly] = useState(initialGapsOnly);
  const [picking, setPicking] = useState<{ req: RequirementItem; currentNodeId: string | null } | null>(null);

  const draftMap = useMemo(() => new Map(drafts.map((d) => [d.outline_node_id, d])), [drafts]);

  const rows = useMemo(() => requirements.map((r) => {
    const owningNode = nodes.find((n) => (n.linked_requirement_ids ?? []).includes(r.id));
    const draft = owningNode ? draftMap.get(owningNode.id) : null;
    const cited = isRequirementCited(draft?.content_html, r.req_number);
    return { req: r, node: owningNode ?? null, draft, cited };
  }), [requirements, nodes, draftMap]);

  const total = rows.length;
  const linked = rows.filter((r) => r.node).length;
  const cited = rows.filter((r) => r.cited).length;
  const gaps = total - linked;
  const visibleRows = gapsOnly ? rows.filter((r) => !r.node) : rows;

  const onPick = async (node: OutlineNode) => {
    if (!picking) return;
    try {
      await assign.mutateAsync({ requirementId: picking.req.id, nodeId: node.id });
      toast.success(`${picking.req.req_number ?? "Requirement"} linked to ${sectionLabel(node)}`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not link requirement");
    }
  };

  const onRemove = async (req: RequirementItem) => {
    if (!outline) return;
    try {
      await unassign.mutateAsync({ requirementId: req.id, outlineId: outline.id });
      toast.success(`${req.req_number ?? "Requirement"} removed from its section`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not remove requirement");
    }
  };

  const exportCsv = () => {
    const header = ["Req #", "Section L", "Requirement", "Volume", "Section", "Owner", "Words", "Cited"];
    const lines = [header.join(",")];
    for (const r of rows) {
      const cells = [
        r.req.req_number ?? "",
        r.req.source_section ?? "",
        (r.req.shall_text ?? "").replace(/\n/g, " ").replace(/"/g, '""'),
        r.node?.volume ?? "",
        r.node ? `${r.node.section_number ?? ""} ${r.node.title}`.trim() : "",
        r.node?.assigned_to ?? "",
        String(r.draft?.word_count ?? 0),
        r.cited ? "Y" : "N",
      ];
      lines.push(cells.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(","));
    }
    const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `compliance-matrix-${solicitationId}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const canAssign = canEdit && !!outline && nodes.length > 0;

  return (
    <Card className="p-4">
      <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
        <div>
          <div className="text-sm font-semibold">Live Compliance Matrix</div>
          <div className="text-xs text-muted-foreground">
            {gaps > 0 && <span className="text-destructive font-medium">{gaps} gap{gaps === 1 ? "" : "s"} · </span>}
            {linked}/{total} requirements linked to a section · {cited} cited in draft text
          </div>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <Switch id="gaps-only" checked={gapsOnly} onCheckedChange={setGapsOnly} />
            <Label htmlFor="gaps-only" className="text-xs">Show gaps only</Label>
          </div>
          <Button size="sm" variant="outline" onClick={exportCsv} disabled={!total}>
            <Download className="h-3.5 w-3.5 mr-1.5" />Export CSV
          </Button>
        </div>
      </div>
      <div className="overflow-auto max-h-[60vh] border rounded-md">
        <table className="w-full text-xs">
          <thead className="bg-muted/50 sticky top-0">
            <tr>
              <th className="text-left p-2 font-medium">Req #</th>
              <th className="text-left p-2 font-medium">Section L</th>
              <th className="text-left p-2 font-medium">Requirement</th>
              <th className="text-left p-2 font-medium">Volume / Section</th>
              <th className="text-left p-2 font-medium">Words</th>
              <th className="text-left p-2 font-medium">Status</th>
              {canAssign && <th className="p-2 w-8" />}
            </tr>
          </thead>
          <tbody>
            {visibleRows.map((r) => (
              <tr key={r.req.id} className="border-t">
                <td className="p-2 font-mono">{r.req.req_number}</td>
                <td className="p-2 text-muted-foreground">{r.req.source_section ?? "—"}</td>
                <td className="p-2 max-w-md">{r.req.shall_text}</td>
                <td className="p-2">
                  {r.node ? (
                    <div>
                      <div>{r.node.volume ?? "—"}</div>
                      <div className="text-muted-foreground">{r.node.section_number} {r.node.title}</div>
                    </div>
                  ) : canAssign ? (
                    <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => setPicking({ req: r.req, currentNodeId: null })}>
                      <Link2 className="h-3 w-3 mr-1" />Assign to section
                    </Button>
                  ) : <span className="text-destructive">Unassigned</span>}
                </td>
                <td className="p-2">{r.draft?.word_count ?? 0}</td>
                <td className="p-2">
                  {r.cited ? <Badge variant="outline">Cited</Badge> :
                    r.draft ? <Badge variant="secondary">Drafted, not cited</Badge> :
                    r.node ? <Badge variant="outline">Pending</Badge> :
                    <Badge variant="destructive">Gap</Badge>}
                </td>
                {canAssign && (
                  <td className="p-2">
                    {r.node && (
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button size="icon" variant="ghost" className="h-6 w-6" aria-label="Requirement actions">
                            <MoreHorizontal className="h-3.5 w-3.5" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => setPicking({ req: r.req, currentNodeId: r.node!.id })}>Move to another section</DropdownMenuItem>
                          <DropdownMenuItem className="text-destructive" onClick={() => onRemove(r.req)}>Remove from section</DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    )}
                  </td>
                )}
              </tr>
            ))}
            {!visibleRows.length && (
              <tr><td colSpan={canAssign ? 7 : 6} className="p-6 text-center text-muted-foreground">
                {total && gapsOnly ? "No gaps — every requirement is linked to a section." : "No requirements extracted yet."}
              </td></tr>
            )}
          </tbody>
        </table>
      </div>
      <SectionPickerDialog
        open={!!picking}
        onOpenChange={(o) => { if (!o) setPicking(null); }}
        nodes={nodes}
        currentNodeId={picking?.currentNodeId}
        onPick={onPick}
      />
    </Card>
  );
}
