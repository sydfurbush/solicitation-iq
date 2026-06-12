import { format } from "date-fns";
import { supabase } from "@/integrations/supabase/client";
import {
  createPdf,
  drawHeader,
  drawTable,
  savePdf,
} from "@/lib/pdf/pdfKit";

type ReqRow = {
  id: string;
  req_number: string;
  shall_text: string;
  source_section: string | null;
  source_citation: string | null;
  page_number: number | null;
  proposal_volume: string | null;
  proposal_section: string | null;
  status: string;
  notes: string | null;
};

type SolRow = {
  id: string;
  title: string;
  solicitation_number: string | null;
  client?: { name: string | null } | null;
};

function verbOf(text: string): string {
  const m = text.match(/\b(shall|must|will|should|may)\b/i);
  return m ? m[1].toLowerCase() : "—";
}

function trunc(s: string | null | undefined, n: number) {
  if (!s) return "—";
  return s.length > n ? `${s.slice(0, n - 1)}…` : s;
}

export async function generateRtmPdf(solicitationId: string): Promise<void> {
  const [{ data: sol }, { data: reqs }] = await Promise.all([
    supabase
      .from("solicitations")
      .select("id, title, solicitation_number, client:clients(name)")
      .eq("id", solicitationId)
      .maybeSingle(),
    supabase
      .from("requirement_items")
      .select(
        "id, req_number, shall_text, source_section, source_citation, page_number, proposal_volume, proposal_section, status, notes"
      )
      .eq("solicitation_id", solicitationId)
      .order("req_number", { ascending: true })
      .limit(2000),
  ]);

  const s = sol as SolRow | null;
  if (!s) throw new Error("Solicitation not found");
  const rows = (reqs ?? []) as ReqRow[];
  if (rows.length === 0) throw new Error("No requirements have been extracted yet.");

  const doc = createPdf({ title: `${s.title} – RTM`, subject: "Requirements Traceability Matrix" });
  let y = drawHeader(doc, {
    title: "Requirements Traceability Matrix",
    subtitle: s.title,
    meta: [
      s.solicitation_number ? `Solicitation ${s.solicitation_number}` : "",
      `Generated ${format(new Date(), "MMM d, yyyy")}`,
    ].filter(Boolean),
  });

  y = drawTable(doc, {
    head: [["Req ID", "Verb", "Source", "Response location", "Status", "Verification"]],
    body: rows.map((r) => [
      r.req_number,
      verbOf(r.shall_text),
      r.source_citation ??
        [r.source_section, r.page_number ? `p.${r.page_number}` : null].filter(Boolean).join(" ") ||
        "—",
      [r.proposal_volume, r.proposal_section].filter(Boolean).join(" · ") || "—",
      r.status,
      trunc(r.notes, 80),
    ]),
    startY: y,
    columnStyles: {
      0: { cellWidth: 60 },
      1: { cellWidth: 50 },
      2: { cellWidth: 120 },
      3: { cellWidth: 110 },
      4: { cellWidth: 60 },
      5: { cellWidth: "auto" },
    },
  });

  savePdf(doc, [s.client?.name ?? "client", s.title ?? "sol", "rtm"], {
    left: s.title,
    center: "RTM",
    showPageNumbers: true,
  });
}
