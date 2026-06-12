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

type ThemeRow = {
  id: string;
  title: string;
  theme_statement: string | null;
  discriminators: string[];
  proof_points: string[];
  ghosting_points: string[];
  status: string;
};

export async function generateWinThemesBriefPdf(solicitationId: string): Promise<void> {
  const [{ data: sol }, { data: themes }] = await Promise.all([
    supabase
      .from("solicitations")
      .select("id, title, solicitation_number, client:clients(name)")
      .eq("id", solicitationId)
      .maybeSingle(),
    supabase
      .from("win_themes")
      .select("id, title, theme_statement, discriminators, proof_points, ghosting_points, status")
      .eq("solicitation_id", solicitationId)
      .order("created_at", { ascending: true })
      .limit(50),
  ]);
  if (!sol) throw new Error("Solicitation not found");
  const rows = (themes ?? []) as ThemeRow[];
  if (rows.length === 0) throw new Error("No win themes have been drafted yet.");

  const doc = createPdf({ title: `${sol.title} – Win Themes`, subject: "Win themes" });
  let y = drawHeader(doc, {
    title: "Win Themes & Discriminators",
    subtitle: sol.title,
    meta: [
      (sol as { solicitation_number?: string | null }).solicitation_number ?? "",
      `Generated ${format(new Date(), "MMM d, yyyy")}`,
    ].filter(Boolean),
  });

  for (const t of rows) {
    y = writeWrapped(doc, t.title, y + 6, { bold: true, size: FONT.h2, gap: 2 });
    if (t.theme_statement) y = writeWrapped(doc, t.theme_statement, y, { gap: 4 });

    if (t.discriminators.length) {
      y = writeWrapped(doc, "Discriminators", y, { bold: true, size: FONT.body, gap: 2 });
      for (const d of t.discriminators) y = writeWrapped(doc, `• ${d}`, y, { indent: 12, gap: 2 });
    }
    if (t.proof_points.length) {
      y = writeWrapped(doc, "Proof points", y + 2, { bold: true, size: FONT.body, gap: 2 });
      for (const p of t.proof_points) y = writeWrapped(doc, `• ${p}`, y, { indent: 12, gap: 2 });
    }
    if (t.ghosting_points.length) {
      y = writeWrapped(doc, "Ghosting (competitor weaknesses)", y + 2, {
        bold: true,
        size: FONT.body,
        gap: 2,
      });
      for (const g of t.ghosting_points)
        y = writeWrapped(doc, `• ${g}`, y, { indent: 12, gap: 2, color: PALETTE.muted });
    }
    y = writeWrapped(doc, `Status: ${t.status}`, y + 2, {
      size: FONT.caption,
      color: PALETTE.muted,
      gap: 8,
    });
  }

  savePdf(
    doc,
    [(sol as { client?: { name?: string } }).client?.name ?? "client", sol.title ?? "sol", "win-themes"],
    { left: sol.title, center: "Win Themes", showPageNumbers: true }
  );
}
