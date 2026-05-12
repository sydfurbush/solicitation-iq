import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import { format } from "date-fns";
import { supabase } from "@/integrations/supabase/client";
import { PHASES, type PhaseType } from "@/lib/validators/solicitation";
import { APPROVAL_LABEL, type PhaseApproval } from "../hooks/usePhaseApprovals";

const PHASE_LABELS: Record<PhaseType, string> = {
  phase_1_initial: "Phase 1 — Initial",
  phase_2_deep_dive: "Phase 2 — Deep Dive",
  phase_3_outline: "Phase 3 — Outline",
  phase_4_win_themes: "Phase 4 — Win Themes",
};

const GATED: PhaseType[] = ["phase_1_initial", "phase_2_deep_dive", "phase_3_outline"];

interface SolicitationLite {
  title: string | null;
  solicitation_number?: string | null;
  issuing_agency?: string | null;
  client?: { name?: string | null } | null;
}

interface ActivityRow {
  user_id: string | null;
  event_type: string;
  created_at: string;
  metadata: { phase?: PhaseType; status?: string; note?: string | null } | null;
}

const STATUS_LABELS: Record<string, string> = {
  pending_review: "Requested review",
  approved: "Approved",
  changes_requested: "Requested changes",
  not_ready: "Reset",
};

export async function exportApprovalsPdf(opts: {
  solicitationId: string;
  solicitation: SolicitationLite;
  approvals: PhaseApproval[];
}) {
  const { solicitationId, solicitation, approvals } = opts;
  const byPhase = new Map(approvals.map((a) => [a.phase, a]));

  // Pull timeline events
  const { data: events } = await supabase
    .from("activity_log")
    .select("user_id, event_type, created_at, metadata")
    .eq("solicitation_id", solicitationId)
    .like("event_type", "phase_approval_%")
    .order("created_at", { ascending: false })
    .limit(200);

  const userIds = Array.from(
    new Set(((events ?? []) as ActivityRow[]).map((e) => e.user_id).filter(Boolean) as string[]),
  );
  const nameMap: Record<string, string> = {};
  if (userIds.length > 0) {
    const [{ data: staff }, { data: clientPpl }] = await Promise.all([
      supabase.from("users").select("id, full_name, email").in("id", userIds),
      supabase.from("client_users").select("id, full_name, email").in("id", userIds),
    ]);
    for (const u of staff ?? []) nameMap[u.id] = u.full_name || u.email || "Staff user";
    for (const u of clientPpl ?? []) nameMap[u.id] = (u.full_name || u.email || "Client user") + " (client)";
  }

  const doc = new jsPDF({ unit: "pt", format: "letter" });
  const pageWidth = doc.internal.pageSize.getWidth();
  const margin = 40;

  // Header
  doc.setFont("helvetica", "bold");
  doc.setFontSize(16);
  doc.text("Approvals Status", margin, 50);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.setTextColor(90);
  let y = 70;
  doc.text(solicitation.title || "Untitled solicitation", margin, y);
  y += 14;
  const meta = [
    solicitation.solicitation_number,
    solicitation.issuing_agency,
    solicitation.client?.name,
  ]
    .filter(Boolean)
    .join("  ·  ");
  if (meta) {
    doc.text(meta, margin, y);
    y += 14;
  }
  doc.setTextColor(140);
  doc.setFontSize(9);
  doc.text(`Generated ${format(new Date(), "PPpp")}`, margin, y);
  doc.setTextColor(0);

  // Phase status table
  autoTable(doc, {
    startY: y + 16,
    head: [["Phase", "Status", "Decided by", "Decided at", "Note"]],
    body: PHASES.map((p) => {
      const a = byPhase.get(p);
      const isGated = GATED.includes(p);
      if (!isGated) return [PHASE_LABELS[p], "No approval required", "—", "—", "—"];
      const status = a?.status ?? "not_ready";
      return [
        PHASE_LABELS[p],
        APPROVAL_LABEL[status as keyof typeof APPROVAL_LABEL],
        a?.decided_by_name ?? "—",
        a?.decided_at ? format(new Date(a.decided_at), "PP p") : "—",
        a?.decision_note ?? "—",
      ];
    }),
    styles: { fontSize: 9, cellPadding: 6, valign: "top" },
    headStyles: { fillColor: [33, 33, 33] },
    columnStyles: { 4: { cellWidth: pageWidth - margin * 2 - 280 } },
    margin: { left: margin, right: margin },
  });

  // Timeline table
  const lastY = (doc as unknown as { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY ?? y + 40;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  doc.text("Activity Timeline", margin, lastY + 28);

  const eventsTyped = (events ?? []) as ActivityRow[];
  if (eventsTyped.length === 0) {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    doc.setTextColor(120);
    doc.text("No approval activity yet.", margin, lastY + 46);
  } else {
    autoTable(doc, {
      startY: lastY + 36,
      head: [["When", "Phase", "Action", "By", "Note"]],
      body: eventsTyped.map((e) => {
        const status = e.metadata?.status ?? e.event_type.replace("phase_approval_", "");
        const phase = e.metadata?.phase;
        return [
          format(new Date(e.created_at), "PP p"),
          phase ? PHASE_LABELS[phase] : "—",
          STATUS_LABELS[status] ?? status,
          e.user_id ? nameMap[e.user_id] ?? "Unknown" : "System",
          e.metadata?.note ?? "—",
        ];
      }),
      styles: { fontSize: 9, cellPadding: 5, valign: "top" },
      headStyles: { fillColor: [33, 33, 33] },
      margin: { left: margin, right: margin },
    });
  }

  // Footer page numbers
  const total = doc.getNumberOfPages();
  for (let i = 1; i <= total; i += 1) {
    doc.setPage(i);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(140);
    doc.text(
      `Page ${i} of ${total} · Internal use only`,
      pageWidth / 2,
      doc.internal.pageSize.getHeight() - 20,
      { align: "center" },
    );
  }

  const safeTitle = (solicitation.title || "approvals").replace(/[^a-z0-9-]+/gi, "-").slice(0, 50);
  doc.save(`approvals-${safeTitle}-${format(new Date(), "yyyyMMdd-HHmm")}.pdf`);
}
