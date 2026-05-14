import { useMemo } from "react";
import { useActiveOutline, useOutlineNodes } from "@/features/outline/hooks/useProposalOutline";
import { useRequirementItems } from "@/features/deepdive/hooks/useRequirementItems";
import { useProposalDrafts } from "../hooks/useProposalDrafts";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Download } from "lucide-react";

interface Props { solicitationId: string }

export function ComplianceMatrix({ solicitationId }: Props) {
  const { data: outline } = useActiveOutline(solicitationId);
  const { data: nodes = [] } = useOutlineNodes(outline?.id);
  const { data: requirements = [] } = useRequirementItems(solicitationId);
  const { data: drafts = [] } = useProposalDrafts(solicitationId);

  const draftMap = useMemo(() => new Map(drafts.map((d) => [d.outline_node_id, d])), [drafts]);
  const nodeMap = useMemo(() => new Map(nodes.map((n) => [n.id, n])), [nodes]);

  const rows = useMemo(() => requirements.map((r) => {
    const owningNode = nodes.find((n) => (n.linked_requirement_ids ?? []).includes(r.id));
    const draft = owningNode ? draftMap.get(owningNode.id) : null;
    const txt = (draft?.content_html ?? "").toLowerCase();
    const cited = txt.includes(`[req-${(r.req_number ?? "").toLowerCase()}]`);
    return { req: r, node: owningNode ?? null, draft, cited };
  }), [requirements, nodes, draftMap]);

  const total = rows.length;
  const linked = rows.filter((r) => r.node).length;
  const cited = rows.filter((r) => r.cited).length;

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

  return (
    <Card className="p-4">
      <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
        <div>
          <div className="text-sm font-semibold">Live Compliance Matrix</div>
          <div className="text-xs text-muted-foreground">
            {linked}/{total} requirements linked to a section · {cited} cited in draft text
          </div>
        </div>
        <Button size="sm" variant="outline" onClick={exportCsv} disabled={!total}>
          <Download className="h-3.5 w-3.5 mr-1.5" />Export CSV
        </Button>
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
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
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
                  ) : <span className="text-destructive">Unassigned</span>}
                </td>
                <td className="p-2">{r.draft?.word_count ?? 0}</td>
                <td className="p-2">
                  {r.cited ? <Badge variant="outline">Cited</Badge> :
                    r.draft ? <Badge variant="secondary">Drafted, not cited</Badge> :
                    r.node ? <Badge variant="outline">Pending</Badge> :
                    <Badge variant="destructive">Gap</Badge>}
                </td>
              </tr>
            ))}
            {!rows.length && (
              <tr><td colSpan={6} className="p-6 text-center text-muted-foreground">No requirements extracted yet.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </Card>
  );
}
