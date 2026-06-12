import { format } from "date-fns";
import { supabase } from "@/integrations/supabase/client";
import {
  createPdf,
  drawHeader,
  writeWrapped,
  savePdf,
  FONT,
  PALETTE,
} from "@/lib/pdf/pdfKit";

type Row = {
  solicitation_id: string;
  awarded_value: number | null;
  awarded_at: string | null;
  notes: string | null;
  solicitation: {
    title: string | null;
    solicitation_number: string | null;
    issuing_agency: string | null;
    contract_type: string | null;
    period_of_performance_start: string | null;
    period_of_performance_end: string | null;
    ai_summary: string | null;
    client: { name: string | null } | null;
  } | null;
};

function fmtUsd(n: number | null): string {
  if (n == null) return "—";
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(2)}M`;
  if (n >= 1_000) return `$${(n / 1_000).toFixed(0)}K`;
  return `$${n.toFixed(0)}`;
}

export async function generatePastPerformancePdf(opts?: { clientId?: string | null }): Promise<void> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let q = (supabase as any)
    .from("solicitation_outcomes")
    .select(
      "solicitation_id, awarded_value, awarded_at, notes, solicitation:solicitations!inner(title, solicitation_number, issuing_agency, contract_type, period_of_performance_start, period_of_performance_end, ai_summary, client_id, client:clients(name))"
    )
    .eq("outcome", "won")
    .order("awarded_at", { ascending: false })
    .limit(200);
  if (opts?.clientId) q = q.eq("solicitation.client_id", opts.clientId);
  const { data, error } = await q;
  if (error) throw error;
  const rows = (data ?? []) as Row[];
  if (rows.length === 0) throw new Error("No wins recorded yet — past performance is empty.");

  const doc = createPdf({ title: "Past Performance", subject: "Past performance reference" });
  let y = drawHeader(doc, {
    title: "Past Performance",
    subtitle: rows[0]?.solicitation?.client?.name ?? "Organization",
    meta: [
      `${rows.length} award${rows.length === 1 ? "" : "s"} on file`,
      `Generated ${format(new Date(), "MMM d, yyyy")}`,
    ],
  });

  for (const r of rows) {
    const s = r.solicitation;
    if (!s) continue;
    y = writeWrapped(doc, s.title ?? "(untitled)", y + 6, { bold: true, size: FONT.h2, gap: 2 });

    const meta = [
      s.client?.name ?? "",
      s.issuing_agency ?? "",
      s.solicitation_number ? `#${s.solicitation_number}` : "",
      s.contract_type ?? "",
    ]
      .filter(Boolean)
      .join(" · ");
    if (meta) y = writeWrapped(doc, meta, y, { color: PALETTE.muted, size: FONT.caption, gap: 2 });

    const period =
      s.period_of_performance_start || s.period_of_performance_end
        ? `Period of performance: ${s.period_of_performance_start ?? "—"} to ${s.period_of_performance_end ?? "—"}`
        : null;
    const award = `Award: ${fmtUsd(r.awarded_value)}${r.awarded_at ? ` · ${r.awarded_at}` : ""}`;
    y = writeWrapped(doc, award, y, { bold: true, gap: 2 });
    if (period) y = writeWrapped(doc, period, y, { size: FONT.caption, color: PALETTE.muted, gap: 2 });

    if (s.ai_summary) y = writeWrapped(doc, s.ai_summary, y + 2, { gap: 4 });
    if (r.notes) y = writeWrapped(doc, `Notes: ${r.notes}`, y, { color: PALETTE.muted, size: FONT.caption });
    y = writeWrapped(doc, "Reference contact: ____________________________", y + 2, {
      size: FONT.caption,
      color: PALETTE.muted,
      gap: 10,
    });
  }

  savePdf(doc, ["past-performance", format(new Date(), "yyyy-MM-dd")], {
    left: rows[0]?.solicitation?.client?.name ?? "Past Performance",
    center: "Past Performance",
    showPageNumbers: true,
  });
}
