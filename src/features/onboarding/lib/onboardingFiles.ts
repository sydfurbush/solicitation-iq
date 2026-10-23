// Pure rules for onboarding uploads (no network). Tested in onboardingFiles.test.ts.

export const ONBOARDING_BUCKET = "client-onboarding";
export const ONBOARDING_MAX_BYTES = 25 * 1024 * 1024;

export const ONBOARDING_ACCEPT: Record<string, string[]> = {
  "application/pdf": [".pdf"],
  "application/msword": [".doc"],
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": [".docx"],
  "application/vnd.ms-excel": [".xls"],
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": [".xlsx"],
  "text/plain": [".txt"],
  "text/markdown": [".md"],
  "text/csv": [".csv"],
};
export const ONBOARDING_EXTENSIONS = Object.values(ONBOARDING_ACCEPT).flat();

export type OnboardingStatus = "uploaded" | "processing" | "triaged" | "failed";

export function validateOnboardingFile(name: string, size: number): string | null {
  const ext = "." + (name.split(".").pop() ?? "").toLowerCase();
  if (!ONBOARDING_EXTENSIONS.includes(ext)) return `Unsupported file type "${ext}"`;
  if (size > ONBOARDING_MAX_BYTES) return "File is larger than 25 MB";
  return null;
}

export function sanitizeOnboardingName(name: string): string {
  return name.replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 150);
}

export function onboardingPath(clientId: string, documentId: string, fileName: string): string {
  return `${clientId}/${documentId}-${sanitizeOnboardingName(fileName)}`;
}

/** Label shown to clients. Never reveals triage results. */
export function clientStatusLabel(status: OnboardingStatus): string {
  switch (status) {
    case "uploaded": return "Uploaded";
    case "processing": return "Processing";
    case "triaged": return "Received";
    case "failed": return "Couldn't read this file";
  }
}

/** Clients may delete their upload until it has been received (triaged). */
export function clientCanDelete(status: OnboardingStatus): boolean {
  return status !== "triaged";
}

export type StaffFilter = "all" | "needs_review" | "restricted" | "needs_cleaning" | "not_needed";

export interface TriageLike {
  destinations: string[] | null;
  final_destinations: string[] | null;
  requires_cleaning: boolean | null;
  reviewed_at: string | null;
}

export function effectiveDestinations(t: TriageLike | null | undefined): string[] {
  if (!t) return [];
  return (t.reviewed_at && t.final_destinations ? t.final_destinations : t.destinations) ?? [];
}

export function matchesFilter(filter: StaffFilter, t: TriageLike | null | undefined): boolean {
  if (filter === "all") return true;
  if (!t) return false;
  if (filter === "needs_review") return !t.reviewed_at;
  if (filter === "needs_cleaning") return !!t.requires_cleaning;
  if (filter === "restricted") return effectiveDestinations(t).includes("restricted");
  return effectiveDestinations(t).includes("not_needed");
}

export type ReceivedVia = "portal" | "email" | "other";
const VIA_LABELS: Record<ReceivedVia, string> = { portal: "Portal", email: "Email", other: "Other" };

/** e.g. "Tori Ingram <tori@x.com>" → "Tori Ingram"; bare email stays as-is. */
export function senderDisplayName(from: string | null | undefined): string {
  const s = (from ?? "").trim();
  if (!s) return "";
  const m = s.match(/^\s*"?([^"<]*?)"?\s*<[^>]+>\s*$/);
  return m && m[1] ? m[1].trim() : s;
}

function formatDay(d: string): string {
  const [y, mo, da] = d.slice(0, 10).split("-").map(Number);
  if (!y || !mo || !da) return d;
  const months = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
  return `${months[mo - 1]} ${da}, ${y}`;
}

/** "Email · Tori Ingram · Oct 23, 2026 (uploaded by Sydney)" / "Portal · Tori Ingram · Oct 23, 2026". */
export function receivedLabel(p: {
  received_via: string | null | undefined;
  received_from?: string | null;
  received_on?: string | null;
  created_at?: string | null;
  uploaderName?: string | null;
}): string {
  const via = (p.received_via ?? "portal") as ReceivedVia;
  const parts = [VIA_LABELS[via] ?? "Other"];
  const who = via === "portal" ? senderDisplayName(p.received_from) || (p.uploaderName ?? "") : senderDisplayName(p.received_from);
  if (who) parts.push(who);
  const day = p.received_on || p.created_at;
  if (day) parts.push(formatDay(day));
  let out = parts.join(" · ");
  if (via !== "portal" && p.uploaderName) out += ` (uploaded by ${p.uploaderName.split(/\s+/)[0]})`;
  return out;
}

/** Only same-origin paths under /portal/ are allowed as post-invite redirects. */
export function safePortalRedirect(next: string | null | undefined, fallback = "/portal"): string {
  if (!next) return fallback;
  if (!/^\/portal\/[A-Za-z0-9\-_/]*$/.test(next)) return fallback;
  if (next.includes("//") || next.includes("..")) return fallback;
  return next;
}
