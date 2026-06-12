import { format } from "date-fns";
import {
  createPdf,
  drawHeader,
  drawTable,
  writeWrapped,
  savePdf,
  slugifyFilename,
  PALETTE,
  FONT,
  MARGINS,
} from "@/lib/pdf/pdfKit";
import { supabase } from "@/integrations/supabase/client";
import type { PortfolioRow } from "@/features/reports-hub/hooks/useReportsHub";

function fmtUsd(n: number | null | undefined): string {
  if (n == null || !Number.isFinite(Number(n))) return "—";
  const v = Number(n);
  if (v >= 1_000_000) return `$${(v / 1_000_000).toFixed(1)}M`;
  if (v >= 1_000) return `$${(v / 1_000).toFixed(0)}K`;
  return `$${v.toFixed(0)}`;
}

type SolRow = {
  id: string;
  title: string | null;
  solicitation_number: string | null;
  status: string | null;
  proposal_due_date: string | null;
  estimated_value_low: number | null;
  estimated_value_high: number | null;
};

type OutcomeRow = {
  solicitation_id: string;
  outcome: string | null;
  awarded_value: number | null;
  awarded_at: string | null;
};

type DeliverableRow = {
  id: string;
  title: string;
  report_type: string | null;
  created_at: string | null;
  solicitation_id: string;
};

export async function generateClientPortfolioReport(portfolio: PortfolioRow): Promise<void> {
  // Pull supporting data for this client
  const [{ data: sols }, { data: deliverables }] = await Promise.all([
    supabase
      .from("solicitations")
      .select("id, title, solicitation_number, status, proposal_due_date, estimated_value_low, estimated_value_high")
      .eq("client_id", portfolio.client_id)
      .order("proposal_due_date", { ascending: true, nullsFirst: false })
      .limit(200),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (supabase as any)
      .from("executive_reports")
      .select("id, title, report_type, created_at, solicitation_id, solicitation:solicitations!inner(client_id)")
      .eq("solicitation.client_id", portfolio.client_id)
      .order("created_at", { ascending: false })
      .limit(50),
  ]);

  const solRows = (sols ?? []) as SolRow[];
  const solIds = solRows.map((s) => s.id);

  let outcomes: OutcomeRow[] = [];
  if (solIds.length) {
    const { data } = await supabase
      .from("solicitation_outcomes")
      .select("solicitation_id, outcome, awarded_value, awarded_at")
      .in("solicitation_id", solIds);
    outcomes = (data ?? []) as OutcomeRow[];
  }
  const outcomeBySol = new Map(outcomes.map((o) => [o.solicitation_id, o]));

  // Build PDF
  const clientName = portfolio.client_name ?? "Client";
  const today = format(new Date(), "MMM d, yyyy");
  const doc = createPdf({ title: `${clientName} – Status Report`, subject: "Client portfolio status report" });
  let y = drawHeader(doc, {
    title: `${clientName}`,
    subtitle: "Client status report",
    meta: [`Generated ${today}`],
  });

  // KPI summary
  const decided = portfolio.won_count + portfolio.lost_count + portfolio.no_bid_count;
  const winRate = decided > 0 ? `${Math.round((portfolio.won_count / decided) * 100)}%` : "—";

  y = drawTable(doc, {
    head: [["Metric", "Value"]],
    body: [
      ["Active solicitations", `${portfolio.active_count} of ${portfolio.solicitation_count}`],
      ["Estimated value (open)", fmtUsd(Number(portfolio.total_est_value))],
      ["Awarded value (to date)", fmtUsd(Number(portfolio.awarded_value_total))],
      ["Wins / Losses / No-bids", `${portfolio.won_count} / ${portfolio.lost_count} / ${portfolio.no_bid_count}`],
      ["Win rate (decided)", winRate],
      ["Cost-to-bid (logged)", fmtUsd(Number(portfolio.cost_to_bid_total))],
    ],
    startY: y + 4,
    columnStyles: { 0: { cellWidth: 200 }, 1: { cellWidth: "auto" } },
  });

  // Active solicitations
  y = writeWrapped(doc, "Active solicitations", y + 8, { bold: true, size: FONT.h2, gap: 4 });
  const active = solRows.filter((s) => s.status && !["awarded", "lost", "no_bid", "withdrawn"].includes(s.status));
  if (active.length === 0) {
    y = writeWrapped(doc, "No active solicitations.", y, { color: PALETTE.muted, gap: 8 });
  } else {
    y = drawTable(doc, {
      head: [["Solicitation", "#", "Status", "Due", "Est. value"]],
      body: active.slice(0, 40).map((s) => [
        s.title ?? "—",
        s.solicitation_number ?? "—",
        s.status ?? "—",
        s.proposal_due_date ? format(new Date(s.proposal_due_date), "MMM d, yyyy") : "—",
        fmtUsd(Number(s.estimated_value_high ?? s.estimated_value_low ?? 0)),
      ]),
      startY: y,
      columnStyles: {
        0: { cellWidth: 200 },
        1: { cellWidth: 70 },
        2: { cellWidth: 70 },
        3: { cellWidth: 80 },
        4: { cellWidth: "auto", halign: "right" },
      },
    });
  }

  // Decided solicitations
  const decidedRows = solRows
    .map((s) => ({ s, o: outcomeBySol.get(s.id) }))
    .filter((r) => r.o && r.o.outcome && r.o.outcome !== "pending");
  if (decidedRows.length > 0) {
    y = writeWrapped(doc, "Recent outcomes", y + 8, { bold: true, size: FONT.h2, gap: 4 });
    y = drawTable(doc, {
      head: [["Solicitation", "Outcome", "Awarded", "Date"]],
      body: decidedRows.slice(0, 30).map(({ s, o }) => [
        s.title ?? "—",
        (o?.outcome ?? "—").replace(/_/g, " "),
        o?.outcome === "won" ? fmtUsd(Number(o?.awarded_value)) : "—",
        o?.awarded_at ? format(new Date(o.awarded_at), "MMM d, yyyy") : "—",
      ]),
      startY: y,
      columnStyles: {
        0: { cellWidth: 240 },
        1: { cellWidth: 80 },
        2: { cellWidth: 80, halign: "right" },
        3: { cellWidth: "auto" },
      },
    });
  }

  // Deliverables
  const delivRows = (deliverables ?? []) as DeliverableRow[];
  if (delivRows.length > 0) {
    y = writeWrapped(doc, "Recent deliverables", y + 8, { bold: true, size: FONT.h2, gap: 4 });
    y = drawTable(doc, {
      head: [["Report", "Type", "Created"]],
      body: delivRows.slice(0, 25).map((r) => [
        r.title ?? "—",
        (r.report_type ?? "—").replace(/_/g, " "),
        r.created_at ? format(new Date(r.created_at), "MMM d, yyyy") : "—",
      ]),
      startY: y,
      columnStyles: {
        0: { cellWidth: 300 },
        1: { cellWidth: 110 },
        2: { cellWidth: "auto" },
      },
    });
  }

  savePdf(
    doc,
    [clientName, "status-report", format(new Date(), "yyyy-MM-dd")],
    { left: clientName, center: "Client status report", showPageNumbers: true },
  );
}

// silence unused — kept for future use
void MARGINS;
void slugifyFilename;
