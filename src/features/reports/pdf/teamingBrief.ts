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

type PartnerRow = {
  id: string;
  name: string;
  role: string;
  set_asides: string[];
  naics_codes: string[];
  workshare_pct: number | null;
  scope_summary: string | null;
  agreement_status: string;
  poc_name: string | null;
  poc_email: string | null;
  poc_phone: string | null;
  notes: string | null;
};

export async function generateTeamingBriefPdf(solicitationId: string): Promise<void> {
  const [{ data: sol }, { data: partners }] = await Promise.all([
    supabase
      .from("solicitations")
      .select("id, title, solicitation_number, issuing_agency, client:clients(name)")
      .eq("id", solicitationId)
      .maybeSingle(),
    supabase
      .from("solicitation_teaming_partners")
      .select(
        "id, name, role, set_asides, naics_codes, workshare_pct, scope_summary, agreement_status, poc_name, poc_email, poc_phone, notes"
      )
      .eq("solicitation_id", solicitationId)
      .order("sort_order", { ascending: true })
      .limit(200),
  ]);
  if (!sol) throw new Error("Solicitation not found");
  const rows = (partners ?? []) as PartnerRow[];
  if (rows.length === 0) throw new Error("No teaming partners recorded yet.");

  const doc = createPdf({ title: `${sol.title} – Teaming Brief`, subject: "Teaming brief" });
  let y = drawHeader(doc, {
    title: "Teaming Strategy Brief",
    subtitle: sol.title,
    meta: [
      (sol as { solicitation_number?: string | null }).solicitation_number ?? "",
      (sol as { issuing_agency?: string | null }).issuing_agency ?? "",
      `Generated ${format(new Date(), "MMM d, yyyy")}`,
    ].filter(Boolean),
  });

  y = drawTable(doc, {
    head: [["Partner", "Role", "NAICS / Set-asides", "Workshare", "Agreement", "POC"]],
    body: rows.map((p) => [
      p.name,
      p.role,
      [p.naics_codes.join(", "), p.set_asides.join(", ")].filter(Boolean).join(" / ") || "—",
      p.workshare_pct != null ? `${p.workshare_pct}%` : "—",
      p.agreement_status,
      [p.poc_name, p.poc_email].filter(Boolean).join("\n") || "—",
    ]),
    startY: y,
    columnStyles: {
      0: { cellWidth: 130 },
      1: { cellWidth: 60 },
      2: { cellWidth: 120 },
      3: { cellWidth: 60, halign: "right" },
      4: { cellWidth: 70 },
      5: { cellWidth: "auto" },
    },
  });

  // Per-partner scope
  for (const p of rows) {
    if (!p.scope_summary && !p.notes) continue;
    y = writeWrapped(doc, p.name, y + 6, { bold: true, size: FONT.h3, gap: 2 });
    if (p.scope_summary) y = writeWrapped(doc, p.scope_summary, y, { gap: 2 });
    if (p.notes) y = writeWrapped(doc, p.notes, y, { color: PALETTE.muted, size: FONT.caption });
  }

  savePdf(
    doc,
    [(sol as { client?: { name?: string } }).client?.name ?? "client", sol.title ?? "sol", "teaming-brief"],
    { left: sol.title, center: "Teaming Brief", showPageNumbers: true }
  );
}
