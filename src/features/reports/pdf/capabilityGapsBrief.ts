import { format } from "date-fns";
import { supabase } from "@/integrations/supabase/client";
import {
  createPdf,
  drawHeader,
  drawTable,
  savePdf,
} from "@/lib/pdf/pdfKit";

type GapRow = {
  id: string;
  gap_type: string;
  severity: string;
  title: string;
  description: string | null;
  recommendation: string | null;
  is_resolved: boolean;
};

function trunc(s: string | null | undefined, n: number) {
  if (!s) return "—";
  return s.length > n ? `${s.slice(0, n - 1)}…` : s;
}

export async function generateCapabilityGapsBriefPdf(solicitationId: string): Promise<void> {
  const [{ data: sol }, { data: gaps }] = await Promise.all([
    supabase
      .from("solicitations")
      .select("id, title, solicitation_number, client:clients(name)")
      .eq("id", solicitationId)
      .maybeSingle(),
    supabase
      .from("capability_gaps")
      .select("id, gap_type, severity, title, description, recommendation, is_resolved")
      .eq("solicitation_id", solicitationId)
      .order("severity", { ascending: false })
      .limit(200),
  ]);
  if (!sol) throw new Error("Solicitation not found");
  const rows = (gaps ?? []) as GapRow[];
  if (rows.length === 0) throw new Error("No capability gaps recorded yet.");

  const doc = createPdf({ title: `${sol.title} – Capability Gaps`, subject: "Capability gaps brief" });
  let y = drawHeader(doc, {
    title: "Capability Gaps",
    subtitle: sol.title,
    meta: [
      (sol as { solicitation_number?: string | null }).solicitation_number ?? "",
      `Generated ${format(new Date(), "MMM d, yyyy")}`,
    ].filter(Boolean),
  });

  y = drawTable(doc, {
    head: [["Severity", "Type", "Gap", "Description", "Recommended action", "Status"]],
    body: rows.map((g) => [
      g.severity,
      g.gap_type,
      g.title,
      trunc(g.description, 180),
      g.recommendation ?? "—",
      g.is_resolved ? "Resolved" : "Open",
    ]),
    startY: y,
    columnStyles: {
      0: { cellWidth: 60 },
      1: { cellWidth: 70 },
      2: { cellWidth: 110 },
      3: { cellWidth: 170 },
      4: { cellWidth: 80 },
      5: { cellWidth: "auto" },
    },
  });

  savePdf(
    doc,
    [(sol as { client?: { name?: string } }).client?.name ?? "client", sol.title ?? "sol", "capability-gaps"],
    { left: sol.title, center: "Capability Gaps", showPageNumbers: true }
  );
}
