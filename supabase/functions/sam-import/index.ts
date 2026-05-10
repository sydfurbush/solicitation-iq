import { corsHeaders } from "https://esm.sh/@supabase/supabase-js@2.95.0/cors";

interface SamNotice {
  noticeId?: string;
  title?: string;
  solicitationNumber?: string;
  fullParentPathName?: string;
  organizationName?: string;
  department?: string;
  typeOfSetAsideDescription?: string;
  typeOfSetAside?: string;
  postedDate?: string;
  responseDeadLine?: string;
  description?: string;
  uiLink?: string;
  resourceLinks?: string[];
  links?: Array<{ rel?: string; href?: string }>;
}

const FEDERAL_KEYWORDS = ["FEDERAL", "DEPARTMENT OF", "DEPT OF", "AGENCY"];

function extractNoticeId(rawUrl: string): string | null {
  try {
    const url = new URL(rawUrl.trim());
    if (!url.hostname.toLowerCase().includes("sam.gov")) return null;
    const fromQuery = url.searchParams.get("noticeid") || url.searchParams.get("noticeId");
    if (fromQuery) return fromQuery.trim();
    // /opp/<id>/view or /opportunities/<id>
    const m = url.pathname.match(/\/(?:opp|opportunities)\/([A-Za-z0-9-]+)/i);
    if (m) return m[1];
    return null;
  } catch {
    return null;
  }
}

function mapSetAside(desc?: string): string | undefined {
  if (!desc) return undefined;
  const d = desc.toUpperCase();
  if (d.includes("SDVOSB") || d.includes("SERVICE-DISABLED")) return "SDVOSB";
  if (d.includes("8(A)") || d.includes("8A")) return "8(a)";
  if (d.includes("WOSB") || d.includes("WOMAN")) return "WOSB";
  if (d.includes("SMALL BUSINESS") || d.includes("SBA")) return "SBA";
  return "Other";
}

function inferAgencyType(parent?: string): string | undefined {
  if (!parent) return undefined;
  const p = parent.toUpperCase();
  if (FEDERAL_KEYWORDS.some((k) => p.includes(k))) return "Federal";
  if (p.includes("STATE OF")) return "State";
  return undefined;
}

function toIsoDate(v?: string): string | undefined {
  if (!v) return undefined;
  const d = new Date(v);
  if (isNaN(d.getTime())) return undefined;
  return d.toISOString();
}

function toDateOnly(v?: string): string | undefined {
  if (!v) return undefined;
  const d = new Date(v);
  if (isNaN(d.getTime())) return undefined;
  return d.toISOString().slice(0, 10);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const apiKey = Deno.env.get("SAM_GOV_API_KEY");
    if (!apiKey) {
      return new Response(JSON.stringify({ error: "SAM_GOV_API_KEY is not configured" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json().catch(() => null);
    const url: string | undefined = body?.url;
    if (!url || typeof url !== "string") {
      return new Response(JSON.stringify({ error: "Missing 'url' in request body" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const noticeId = extractNoticeId(url);
    if (!noticeId) {
      return new Response(
        JSON.stringify({ error: "Could not parse a SAM.gov notice ID from that URL" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // SAM.gov requires a postedFrom/postedTo window. Use a wide window (last 5 years).
    const today = new Date();
    const past = new Date();
    past.setFullYear(today.getFullYear() - 5);
    const fmt = (d: Date) =>
      `${String(d.getMonth() + 1).padStart(2, "0")}/${String(d.getDate()).padStart(2, "0")}/${d.getFullYear()}`;

    const apiUrl = new URL("https://api.sam.gov/opportunities/v2/search");
    apiUrl.searchParams.set("api_key", apiKey);
    apiUrl.searchParams.set("noticeid", noticeId);
    apiUrl.searchParams.set("postedFrom", fmt(past));
    apiUrl.searchParams.set("postedTo", fmt(today));
    apiUrl.searchParams.set("limit", "1");

    const res = await fetch(apiUrl.toString(), {
      headers: { Accept: "application/json" },
    });

    if (!res.ok) {
      const text = await res.text();
      console.error("SAM.gov API error", res.status, text);
      return new Response(
        JSON.stringify({
          error: `SAM.gov API returned ${res.status}`,
          detail: text.slice(0, 500),
        }),
        { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const json = (await res.json()) as { opportunitiesData?: SamNotice[]; totalRecords?: number };
    const notice = json.opportunitiesData?.[0];

    if (!notice) {
      return new Response(
        JSON.stringify({ error: "No SAM.gov notice found for that URL" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const setAside = mapSetAside(notice.typeOfSetAsideDescription);
    const agency = notice.fullParentPathName || notice.organizationName || notice.department;

    const prefill = {
      title: notice.title?.trim(),
      solicitation_number: notice.solicitationNumber?.trim(),
      issuing_agency: agency?.replace(/\./g, " › ").trim(),
      agency_type: inferAgencyType(agency),
      set_aside: setAside,
      release_date: toDateOnly(notice.postedDate),
      proposal_due_date: toIsoDate(notice.responseDeadLine),
      sam_url: notice.uiLink || url,
      notes: notice.description ? notice.description.slice(0, 4000) : undefined,
      attachments: (notice.resourceLinks ?? []).map((href) => ({ href })),
    };

    return new Response(JSON.stringify({ prefill, noticeId }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("sam-import error", e);
    const msg = e instanceof Error ? e.message : String(e);
    return new Response(JSON.stringify({ error: msg }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
