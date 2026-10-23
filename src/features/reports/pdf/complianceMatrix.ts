import { format } from "date-fns";
import { supabase } from "@/integrations/supabase/client";
import type { RequirementItem } from "@/features/deepdive/hooks/useRequirementItems";
import { groupRequirements, rollupGroup, WORKFLOW_LABELS } from "@/features/deepdive/utils/matrix";
import {
  createPdf,
  drawHeader,
  drawTable,
  writeWrapped,
  savePdf,
  FONT,
  PALETTE,
} from "@/lib/pdf/pdfKit";

type ReqRow = RequirementItem;

type OutlineRow = {
  id: string;
  volume: string | null;
  section_number: string | null;
  title: string;
  assigned_to: string | null;
  writing_status: string;
  linked_requirement_ids: string[];
};

type SolRow = {
  id: string;
  title: string;
  solicitation_number: string | null;
  issuing_agency: string | null;
  client?: { name: string | null } | null;
};

async function loadCtx(solicitationId: string) {
  const [{ data: sol, error: solError }, reqs, { data: outlines, error: outlineError }] = await Promise.all([
    supabase
      .from("solicitations")
      .select("id, title, solicitation_number, issuing_agency, client:clients(name)")
      .eq("id", solicitationId)
      .maybeSingle(),
    (async () => {
      const rows: ReqRow[] = [];
      for (let offset = 0; ; offset += 1000) {
        const { data, error } = await supabase.from("requirement_items").select("*").eq("solicitation_id", solicitationId).order("req_number").order("id").range(offset, offset + 999);
        if (error) throw error;
        rows.push(...(data ?? []));
        if ((data?.length ?? 0) < 1000) return rows;
      }
    })(),
    supabase
      .from("proposal_outlines")
      .select("id, outline_nodes(id, volume, section_number, title, assigned_to, writing_status, linked_requirement_ids)")
      .eq("solicitation_id", solicitationId)
      .eq("is_active", true)
      .order("version", { ascending: false })
      .limit(1),
  ]);
  if (solError) throw solError;
  if (outlineError) throw outlineError;

  const nodes: OutlineRow[] = [];
  for (const o of (outlines ?? []) as Array<{ outline_nodes?: OutlineRow[] }>) {
    for (const n of o.outline_nodes ?? []) nodes.push(n);
  }
  const outlineByReq = new Map<string, OutlineRow[]>();
  for (const n of nodes) {
    for (const rid of n.linked_requirement_ids ?? []) {
      const arr = outlineByReq.get(rid) ?? [];
      arr.push(n);
      outlineByReq.set(rid, arr);
    }
  }
  return { sol: sol as SolRow | null, reqs, outlineByReq, nodes };
}

function trunc(s: string | null | undefined, n: number) {
  if (!s) return "—";
  return s.length > n ? `${s.slice(0, n - 1)}…` : s;
}

export async function generateComplianceMatrixPdf(solicitationId: string): Promise<void> {
  const { sol, reqs, nodes } = await loadCtx(solicitationId);
  const groups = groupRequirements(reqs).filter(g => g.master.applicability === "proposal");
  if (!sol) throw new Error("Solicitation not found");
  if (groups.length === 0) throw new Error("No proposal requirements are available.");

  const doc = createPdf({ title: `${sol.title} – Compliance Matrix`, subject: "Compliance Matrix" });
  let y = drawHeader(doc, {
    title: "Compliance Matrix",
    subtitle: sol.title,
    meta: [
      sol.solicitation_number ? `Solicitation ${sol.solicitation_number}` : "",
      sol.issuing_agency ?? "",
      `Generated ${format(new Date(), "MMM d, yyyy")}`,
    ].filter(Boolean),
  });

  y = drawTable(doc, {
    head: [["ID", "Area", "Requirement", "Reference", "Proposal location", "Status", "Criticality", "Owner"]],
    body: groups.map((group) => {
      const r = group.master;
      const linked = rollupGroup(group, nodes, []).nodes;
      const volSec = linked.length
        ? linked.map((n) => `${n.volume ?? ""} ${n.section_number ?? n.title}`.trim()).join("; ")
        : [r.proposal_volume, r.proposal_section].filter(Boolean).join(" · ") || "—";
      const source = r.source_citation
        ? r.source_citation
        : [r.source_section, r.page_number ? `p.${r.page_number}` : null].filter(Boolean).join(" ") || "—";
      return [
        r.req_number,
        r.area ?? "—",
        trunc(r.shall_text, 220),
        source,
        volSec,
        WORKFLOW_LABELS[r.workflow_status] ?? r.workflow_status,
        r.criticality ?? "—",
        r.compliance_owner ?? "—",
      ];
    }),
    startY: y,
    columnStyles: {
      0: { cellWidth: 35 },
      1: { cellWidth: 50 },
      2: { cellWidth: 125 },
      3: { cellWidth: 45 },
      4: { cellWidth: 65 },
      5: { cellWidth: 55 },
      6: { cellWidth: 40 },
      7: { cellWidth: 53 },
    },
  });

  const unmapped = groups.filter(group => rollupGroup(group, nodes, []).gap).length;
  if (unmapped > 0) {
    y = writeWrapped(
      doc,
      `${unmapped} of ${groups.length} requirements are not yet mapped to a proposal section.`,
      y + 6,
      { size: FONT.caption, color: PALETTE.muted }
    );
  }

  savePdf(doc, [sol.client?.name ?? "client", sol.title ?? "sol", "compliance-matrix"], {
    left: sol.title,
    center: "Compliance Matrix",
    showPageNumbers: true,
  });
}
