// Shared helper: load the per-solicitation teaming roster and format it for AI prompts.
// Uses service role since edge functions don't run as the user.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

const ROLE_LABEL: Record<string, string> = {
  prime: "Prime",
  sub: "Subcontractor",
  teaming: "Teaming partner",
  mentor_protege: "Mentor/Protégé",
};
const AGREEMENT_LABEL: Record<string, string> = {
  none: "No agreement",
  nda: "NDA",
  ta: "Teaming Agreement",
  loi: "LOI",
  subcontract: "Subcontract executed",
};

export interface TeamingPartnerLite {
  name: string;
  role: string;
  set_asides: string[];
  naics_codes: string[];
  workshare_pct: number | null;
  scope_summary: string | null;
  agreement_status: string;
  poc_name: string | null;
  poc_email: string | null;
  clearance_level: string | null;
  cleared_staff_count: number | null;
  notes: string | null;
}

export async function loadTeamingRoster(solicitationId: string): Promise<TeamingPartnerLite[]> {
  if (!SUPABASE_URL || !SERVICE_KEY) return [];
  try {
    const supa = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });
    const { data, error } = await supa
      .from("solicitation_teaming_partners")
      .select(
        "name, role, set_asides, naics_codes, workshare_pct, scope_summary, agreement_status, poc_name, poc_email, clearance_level, cleared_staff_count, notes",
      )
      .eq("solicitation_id", solicitationId)
      .order("sort_order", { ascending: true });
    if (error) {
      console.warn("[teaming] load failed", error.message);
      return [];
    }
    return (data ?? []) as TeamingPartnerLite[];
  } catch (e) {
    console.warn("[teaming] load exception", e);
    return [];
  }
}

/** Render a compact prompt block. Returns empty string if no partners. */
export function formatTeamingForPrompt(roster: TeamingPartnerLite[]): string {
  if (!roster.length) return "";
  const totalShare = roster.reduce((acc, p) => acc + (Number(p.workshare_pct) || 0), 0);
  const lines = roster.map((p) => {
    const parts: string[] = [];
    parts.push(`• ${p.name} — ${ROLE_LABEL[p.role] ?? p.role}`);
    if (p.workshare_pct != null) parts.push(`${p.workshare_pct}% workshare`);
    if (p.set_asides?.length) parts.push(`tags: ${p.set_asides.join(", ")}`);
    if (p.naics_codes?.length) parts.push(`NAICS: ${p.naics_codes.join(", ")}`);
    parts.push(`agreement: ${AGREEMENT_LABEL[p.agreement_status] ?? p.agreement_status}`);
    if (p.scope_summary) parts.push(`scope: ${p.scope_summary}`);
    if (p.clearance_level) {
      parts.push(
        `cleared: ${p.clearance_level}${
          p.cleared_staff_count ? ` (${p.cleared_staff_count} staff)` : ""
        }`,
      );
    }
    if (p.poc_name || p.poc_email) {
      parts.push(`POC: ${[p.poc_name, p.poc_email].filter(Boolean).join(" / ")}`);
    }
    if (p.notes) parts.push(`notes: ${p.notes}`);
    return parts.join(" · ");
  });
  return [
    "TEAMING ROSTER (for this solicitation):",
    ...lines,
    `Total declared workshare: ${Math.round(totalShare * 10) / 10}%`,
    "Treat scope covered by a named subcontractor as a teaming-mitigated capability, not a hard gap.",
  ].join("\n");
}

export async function getTeamingPromptBlock(solicitationId: string): Promise<string> {
  const roster = await loadTeamingRoster(solicitationId);
  return formatTeamingForPrompt(roster);
}
