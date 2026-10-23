import type { RequirementItem } from "../hooks/useRequirementItems";
import { isRequirementCited } from "../../../../supabase/functions/_shared/requirementLinks";

export const WORKFLOW_LABELS: Record<string, string> = {
  not_started: "Not started", drafted: "Drafted", pending_customer: "Pending customer",
  pending_government: "Pending government", pending_pricing: "Pending pricing", final_review: "Final review", ready: "Ready",
};
export interface RequirementGroup { master: RequirementItem; details: RequirementItem[] }
export function groupRequirements(items: RequirementItem[]): RequirementGroup[] {
  return items.filter(r => r.covered_by_id === null).map(master => ({ master, details: items.filter(r => r.covered_by_id === master.id) }));
}
export interface MatrixNode { id: string; linked_requirement_ids: string[] | null; volume?: string | null; section_number?: string | null; title?: string }
export interface MatrixDraft { outline_node_id: string; content_html: string | null; word_count?: number | null }
export function rollupGroup(group: RequirementGroup, nodes: MatrixNode[], drafts: MatrixDraft[]) {
  const items = [group.master, ...group.details];
  const linkedNodes = nodes.filter(n => items.some(r => n.linked_requirement_ids?.includes(r.id)));
  const linkedDrafts = drafts.filter(d => linkedNodes.some(n => n.id === d.outline_node_id));
  const cited = items.some(r => drafts.some(d => isRequirementCited(d.content_html, r.req_number)));
  return { linked: linkedNodes.length > 0, cited, drafted: linkedDrafts.length > 0, nodes: linkedNodes, gap: linkedNodes.length === 0 };
}
export interface MatrixFilters { applicability: string; area: string; status: string; criticality: string; clarification: boolean; gapsOnly: boolean }
export function matchesMatrixFilters(group: RequirementGroup, filters: MatrixFilters, gap: boolean): boolean {
  const r = group.master;
  return (filters.applicability === "all" || r.applicability === filters.applicability)
    && (filters.area === "all" || r.area === filters.area)
    && (filters.status === "all" || r.workflow_status === filters.status)
    && (filters.criticality === "all" || r.criticality === filters.criticality)
    && (!filters.clarification || r.needs_clarification)
    && (!filters.gapsOnly || gap);
}
export const CSV_COLUMNS = ["ID", "Area", "Type", "Reference", "Requirement", "Proposal location", "Status", "Criticality", "Owner", "Needs clarification", "Link/draft/cited status", "Response/evidence", "Action needed", "Verified at", "Verified by", "Applicability", "Master ID"] as const;
export function matrixCsv(groups: RequirementGroup[], nodes: MatrixNode[], drafts: MatrixDraft[]): string {
  const escape = (value: unknown) => `"${String(value ?? "").replace(/"/g, '""')}"`;
  const lines: unknown[][] = [[...CSV_COLUMNS]];
  for (const group of groups) for (const req of [group.master, ...group.details]) {
    const rollup = rollupGroup({ master: req, details: req === group.master ? group.details : [] }, nodes, drafts);
    const location = rollup.nodes.map(n => [n.volume, n.section_number, n.title].filter(Boolean).join(" ")).join("; ") || req.proposal_section;
    lines.push([req.req_number, req.area, req.requirement_type, req.source_section, req.shall_text, location,
      WORKFLOW_LABELS[req.workflow_status] ?? req.workflow_status, req.criticality, req.compliance_owner,
      req.needs_clarification ? "Yes" : "No", rollup.cited ? "Cited" : rollup.drafted ? "Drafted, not cited" : rollup.linked ? "Pending" : "Gap",
      req.response_evidence, req.action_needed, req.verified_at, req.verified_by, req.applicability, req === group.master ? "" : group.master.req_number]);
  }
  return lines.map(line => line.map(escape).join(",")).join("\r\n");
}
export function validateMatrixFile(file: { name: string; size: number }): string | null {
  if (!/\.(xlsx|xls|csv)$/i.test(file.name)) return "Choose an Excel (.xlsx, .xls) or CSV file.";
  if (file.size > 5 * 1024 * 1024) return "File is larger than 5 MB.";
  return null;
}
