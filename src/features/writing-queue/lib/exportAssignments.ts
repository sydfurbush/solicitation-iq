import type { ExportDocument } from "@/features/exports/lib/exporters";
import type { WritingQueueRow } from "../hooks/useWritingQueue";
import type { OrgMember } from "@/features/collaboration/hooks/useOrgMembers";

const STATUS_LABELS: Record<string, string> = {
  not_started: "Not started",
  drafting: "Drafting",
  pink_ready: "Pink ready",
  red_ready: "Red ready",
  final: "Final",
};

export function buildAssignmentsExport(opts: {
  rows: WritingQueueRow[];
  members: OrgMember[];
  solicitationTitle?: string;
  clientName?: string;
}): ExportDocument | null {
  const { rows, members, solicitationTitle, clientName } = opts;
  if (!rows.length) return null;

  const memberName = (id: string | null) => {
    if (!id) return "Unassigned";
    const m = members.find((x) => x.id === id);
    return m?.full_name ?? m?.email ?? "Unassigned";
  };

  // Group by owner
  const byOwner = new Map<string, WritingQueueRow[]>();
  for (const r of rows) {
    const key = memberName(r.node.assigned_to);
    const list = byOwner.get(key) ?? [];
    list.push(r);
    byOwner.set(key, list);
  }

  const sections = [...byOwner.entries()]
    .sort(([a], [b]) => (a === "Unassigned" ? 1 : b === "Unassigned" ? -1 : a.localeCompare(b)))
    .map(([owner, list]) => ({
      heading: `${owner} — ${list.length} section${list.length === 1 ? "" : "s"}`,
      table: {
        head: ["Priority", "#", "Volume", "Title", "Pages", "Reqs", "Themes", "Status", "Due", "L Ref"],
        rows: list
          .sort((a, b) => b.priority.total - a.priority.total)
          .map((r) => [
            String(r.priority.total),
            r.node.section_number ?? "",
            r.node.volume ?? "",
            r.node.title ?? "",
            r.node.page_allocation ? String(r.node.page_allocation) : "",
            String(r.linkedRequirements.length),
            String(r.themes.length),
            STATUS_LABELS[(r.node.writing_status ?? "not_started") as string] ?? "",
            r.node.due_date ?? "",
            r.node.source_l_reference ?? "",
          ]),
      },
    }));

  return {
    title: "Writing Assignments",
    subtitle: `${rows.length} sections across ${byOwner.size} owner${byOwner.size === 1 ? "" : "s"}`,
    filenameBase: "writing_assignments",
    sections,
    cover: { clientName, solicitationTitle, phase: "phase_3_outline" },
  };
}
