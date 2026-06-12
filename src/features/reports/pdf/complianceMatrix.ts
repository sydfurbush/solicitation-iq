import { format } from "date-fns";
import { supabase } from "@/integrations/supabase/client";
import {
  createPdf,
  drawHeader,
  drawTable,
  writeWrapped,
  savePdf,
  FONT,
  PALETTE,
} from "@/lib/pdf/pdfKit";

type ReqRow = {
  id: string;
  req_number: string;
  shall_text: string;
  source_section: string | null;
  source_citation: string | null;
  page_number: number | null;
  compliance_owner: string | null;
  proposal_volume: string | null;
  proposal_section: string | null;
  status: string;
  notes: string | null;
};

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
  const [{ data: sol }, { data: reqs }, { data: outlines }] = await Promise.all([
    supabase
      .from("solicitations")
      .select("id, title, solicitation_number, issuing_agency, client:clients(name)")
      .eq("id", solicitationId)
      .maybeSingle(),
    supabase
      .from("requirement_items")
      .select(
        "id, req_number, shall_text, source_section, source_citation, page_number, compliance_owner, proposal_volume, proposal_section, status, notes"
      )
      .eq("solicitation_id", solicitationId)
      .order("req_number", { ascending: true })
      .limit(2000),
    supabase
      .from("proposal_outlines")
      .select("id, outline_nodes(id, volume, section_number, title, assigned_to, writing_status, linked_requirement_ids)")
      .eq("solicitation_id", solicitationId)
      .limit(5),
  ]);

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
  return { sol: sol as SolRow | null, reqs: (reqs ?? []) as ReqRow[], outlineByReq };
}

function trunc(s: string | null | undefined, n: number) {
  if (!s) return "—";
  return s.length > n ? `${s.slice(0, n - 1)}…` : s;
}

export async function generateComplianceMatrixPdf(solicitationId: string): Promise<void> {
  const { sol, reqs, outlineByReq } = await loadCtx(solicitationId);
  if (!sol) throw new Error("Solicitation not found");
  if (reqs.length === 0) throw new Error("No requirements have been extracted yet. Run the RTM extraction first.");

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
    head: [["#", "Requirement", "Source", "Volume / Section", "Owner", "Status"]],
    body: reqs.map((r) => {
      const linked = outlineByReq.get(r.id) ?? [];
      const volSec = linked.length
        ? linked.map((n) => `${n.volume ?? ""} ${n.section_number ?? n.title}`.trim()).join("; ")
        : [r.proposal_volume, r.proposal_section].filter(Boolean).join(" · ") || "—";
      const source = r.source_citation
        ? r.source_citation
        : [r.source_section, r.page_number ? `p.${r.page_number}` : null].filter(Boolean).join(" ") || "—";
      return [
        r.req_number,
        trunc(r.shall_text, 220),
        source,
        volSec,
        r.compliance_owner ?? "—",
        r.status,
      ];
    }),
    startY: y,
    columnStyles: {
      0: { cellWidth: 50 },
      1: { cellWidth: 200 },
      2: { cellWidth: 90 },
      3: { cellWidth: 90 },
      4: { cellWidth: 60 },
      5: { cellWidth: "auto" },
    },
  });

  const unmapped = reqs.filter((r) => (outlineByReq.get(r.id)?.length ?? 0) === 0).length;
  if (unmapped > 0) {
    y = writeWrapped(
      doc,
      `${unmapped} of ${reqs.length} requirements are not yet mapped to a proposal section.`,
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
