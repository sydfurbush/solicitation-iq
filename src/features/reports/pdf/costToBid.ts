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

type TimeRow = {
  id: string;
  user_id: string;
  entry_date: string;
  hours: number;
  billable: boolean;
  phase: string | null;
  notes: string | null;
};

type RateRow = {
  user_id: string;
  hourly_rate: number;
  effective_from: string;
  effective_to: string | null;
};

type UserRow = { id: string; full_name: string | null; email: string | null };

function fmtUsd(n: number): string {
  if (!Number.isFinite(n)) return "$0";
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(2)}M`;
  if (n >= 1_000) return `$${(n / 1_000).toFixed(1)}K`;
  return `$${n.toFixed(0)}`;
}

function rateForDate(rates: RateRow[], userId: string, date: string): number {
  const r = rates.find(
    (r) =>
      r.user_id === userId &&
      r.effective_from <= date &&
      (r.effective_to == null || r.effective_to > date)
  );
  return r?.hourly_rate ?? 0;
}

const PHASE_LABEL: Record<string, string> = {
  phase_1_initial: "Phase 1 — Initial",
  phase_2_deep_dive: "Phase 2 — Deep Dive",
  phase_3_outline: "Phase 3 — Outline",
};

export async function generateCostToBidPdf(solicitationId: string): Promise<void> {
  const [{ data: sol }, { data: entries }] = await Promise.all([
    supabase
      .from("solicitations")
      .select("id, title, solicitation_number, estimated_value_low, estimated_value_high, client:clients(name)")
      .eq("id", solicitationId)
      .maybeSingle(),
    supabase
      .from("time_entries")
      .select("id, user_id, entry_date, hours, billable, phase, notes")
      .eq("solicitation_id", solicitationId)
      .order("entry_date", { ascending: false })
      .limit(2000),
  ]);
  if (!sol) throw new Error("Solicitation not found");
  const rows = (entries ?? []) as TimeRow[];

  const userIds = Array.from(new Set(rows.map((r) => r.user_id)));
  let users: UserRow[] = [];
  let rates: RateRow[] = [];
  if (userIds.length > 0) {
    const [{ data: us }, { data: rs }] = await Promise.all([
      supabase.from("users").select("id, full_name, email").in("id", userIds),
      supabase
        .from("user_rates")
        .select("user_id, hourly_rate, effective_from, effective_to")
        .in("user_id", userIds),
    ]);
    users = (us ?? []) as UserRow[];
    rates = (rs ?? []) as RateRow[];
  }

  const userName = (id: string) => {
    const u = users.find((x) => x.id === id);
    return u?.full_name || u?.email || "Unknown";
  };

  let totalHours = 0;
  let billableHours = 0;
  let cost = 0;
  const byUser = new Map<string, { hours: number; billable: number; cost: number }>();
  const byPhase = new Map<string, { hours: number; cost: number }>();

  for (const r of rows) {
    const hours = Number(r.hours);
    totalHours += hours;
    if (r.billable) billableHours += hours;
    const rate = rateForDate(rates, r.user_id, r.entry_date);
    const c = rate * hours;
    cost += c;

    const u = byUser.get(r.user_id) ?? { hours: 0, billable: 0, cost: 0 };
    u.hours += hours;
    if (r.billable) u.billable += hours;
    u.cost += c;
    byUser.set(r.user_id, u);

    const p = r.phase ?? "(unassigned)";
    const ph = byPhase.get(p) ?? { hours: 0, cost: 0 };
    ph.hours += hours;
    ph.cost += c;
    byPhase.set(p, ph);
  }

  const estValue = Number(
    (sol as { estimated_value_high?: number | null; estimated_value_low?: number | null }).estimated_value_high ??
      (sol as { estimated_value_low?: number | null }).estimated_value_low ??
      0
  );
  const costRatio = estValue > 0 ? `${((cost / estValue) * 100).toFixed(2)}% of est. value` : "—";

  const doc = createPdf({ title: `${sol.title} – Cost to Bid`, subject: "Cost to bid / time utilization" });
  let y = drawHeader(doc, {
    title: "Cost to Bid · Time & Utilization",
    subtitle: sol.title,
    meta: [
      (sol as { solicitation_number?: string | null }).solicitation_number
        ? `Solicitation ${(sol as { solicitation_number?: string | null }).solicitation_number}`
        : "",
      `Generated ${format(new Date(), "MMM d, yyyy")}`,
    ].filter(Boolean),
  });

  y = drawTable(doc, {
    head: [["Metric", "Value"]],
    body: [
      ["Total hours", totalHours.toFixed(2)],
      ["Billable hours", billableHours.toFixed(2)],
      ["Cost-to-bid", fmtUsd(cost)],
      ["Estimated value", estValue > 0 ? fmtUsd(estValue) : "—"],
      ["Cost ratio", costRatio],
      ["People involved", String(byUser.size)],
    ],
    startY: y + 4,
    columnStyles: { 0: { cellWidth: 200 }, 1: { cellWidth: "auto" } },
  });

  // By person
  if (byUser.size > 0) {
    y = writeWrapped(doc, "By person", y + 8, { bold: true, size: FONT.h2, gap: 4 });
    const userRows = Array.from(byUser.entries())
      .map(([uid, v]) => ({ uid, ...v, blended: v.hours > 0 ? v.cost / v.hours : 0 }))
      .sort((a, b) => b.cost - a.cost);
    y = drawTable(doc, {
      head: [["Person", "Hours", "Billable", "Blended rate", "Cost"]],
      body: userRows.map((u) => [
        userName(u.uid),
        u.hours.toFixed(2),
        u.billable.toFixed(2),
        `$${u.blended.toFixed(0)}/h`,
        fmtUsd(u.cost),
      ]),
      startY: y,
      columnStyles: {
        0: { cellWidth: 200 },
        1: { cellWidth: 70, halign: "right" },
        2: { cellWidth: 70, halign: "right" },
        3: { cellWidth: 90, halign: "right" },
        4: { cellWidth: "auto", halign: "right" },
      },
    });
  }

  // By phase
  if (byPhase.size > 0) {
    y = writeWrapped(doc, "By phase", y + 8, { bold: true, size: FONT.h2, gap: 4 });
    const phaseRows = Array.from(byPhase.entries()).sort((a, b) => b[1].hours - a[1].hours);
    y = drawTable(doc, {
      head: [["Phase", "Hours", "% of total", "Cost"]],
      body: phaseRows.map(([p, v]) => [
        PHASE_LABEL[p] ?? p,
        v.hours.toFixed(2),
        totalHours > 0 ? `${((v.hours / totalHours) * 100).toFixed(0)}%` : "—",
        fmtUsd(v.cost),
      ]),
      startY: y,
      columnStyles: {
        0: { cellWidth: 220 },
        1: { cellWidth: 70, halign: "right" },
        2: { cellWidth: 90, halign: "right" },
        3: { cellWidth: "auto", halign: "right" },
      },
    });
  }

  if (rows.length === 0) {
    y = writeWrapped(doc, "No time has been logged yet on this solicitation.", y + 8, {
      color: PALETTE.muted,
    });
  } else {
    y = writeWrapped(
      doc,
      "Costs are calculated using each contributor's rate effective on the day the time was logged.",
      y + 8,
      { size: FONT.caption, color: PALETTE.muted }
    );
  }

  savePdf(
    doc,
    [(sol as { client?: { name?: string } }).client?.name ?? "client", sol.title ?? "sol", "cost-to-bid"],
    { left: sol.title, center: "Cost to Bid", showPageNumbers: true }
  );
}
