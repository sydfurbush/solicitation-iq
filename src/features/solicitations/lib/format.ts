import type { SolicitationStatus } from "@/lib/validators/solicitation";

export const STATUS_LABELS: Record<SolicitationStatus, string> = {
  intake: "Intake",
  processing: "Processing",
  phase_1_complete: "Phase 1 complete",
  phase_2_active: "Phase 2 active",
  phase_3_active: "Phase 3 active",
  phase_4_active: "Phase 4 active",
  complete: "Complete",
  archived: "Archived",
};

// Tailwind classes for each status badge
export const STATUS_CLASSES: Record<SolicitationStatus, string> = {
  intake: "bg-muted text-muted-foreground border-transparent",
  processing: "bg-blue-500/15 text-blue-600 dark:text-blue-400 border-transparent",
  phase_1_complete: "bg-green-500/15 text-green-600 dark:text-green-400 border-transparent",
  phase_2_active: "bg-purple-500/15 text-purple-600 dark:text-purple-400 border-transparent",
  phase_3_active: "bg-orange-500/15 text-orange-600 dark:text-orange-400 border-transparent",
  phase_4_active: "bg-pink-500/15 text-pink-600 dark:text-pink-400 border-transparent",
  complete: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-transparent",
  archived: "bg-slate-500/15 text-slate-600 dark:text-slate-400 border-transparent",
};

export function formatCurrency(n: number | null | undefined): string {
  if (n === null || n === undefined) return "—";
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(n);
}

export function formatRange(low?: number | null, high?: number | null): string {
  if (low == null && high == null) return "—";
  if (low != null && high != null) return `${formatCurrency(low)} – ${formatCurrency(high)}`;
  return formatCurrency(low ?? high);
}

export function daysUntil(date: string | null | undefined): number | null {
  if (!date) return null;
  const ms = new Date(date).getTime() - Date.now();
  return Math.ceil(ms / (1000 * 60 * 60 * 24));
}

export type DueUrgency = "overdue" | "danger" | "warning" | "normal" | "none";

export function dueUrgency(date: string | null | undefined): DueUrgency {
  const d = daysUntil(date);
  if (d === null) return "none";
  if (d < 0) return "overdue";
  if (d < 7) return "danger";
  if (d < 14) return "warning";
  return "normal";
}
