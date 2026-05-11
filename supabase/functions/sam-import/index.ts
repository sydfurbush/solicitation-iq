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
    const solicitationNumber: string | undefined = body?.solicitationNumber;

    if ((!url || typeof url !== "string") && (!solicitationNumber || typeof solicitationNumber !== "string")) {
      return new Response(JSON.stringify({ error: "Provide 'url' or 'solicitationNumber' in body" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const noticeId = url ? extractNoticeId(url) : null;
    if (url && !noticeId && !solicitationNumber) {
      return new Response(
        JSON.stringify({ error: "Could not parse a SAM.gov notice ID from that URL" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // SAM.gov caps postedFrom/postedTo to a 1-year window.
    // Notices for prior solicitations are often older, so sweep back year-by-year.
    const fmt = (d: Date) =>
      `${String(d.getMonth() + 1).padStart(2, "0")}/${String(d.getDate()).padStart(2, "0")}/${d.getFullYear()}`;

    const MAX_YEARS_BACK = 6;
    const WINDOW_DAYS = 364;
    let notice: SamNotice | undefined;
    let lastErrorText = "";
    let lastStatus = 0;

    for (let i = 0; i < MAX_YEARS_BACK; i++) {
      const to = new Date(Date.now() - i * WINDOW_DAYS * 24 * 60 * 60 * 1000);
      const from = new Date(to.getTime() - WINDOW_DAYS * 24 * 60 * 60 * 1000);

      const apiUrl = new URL("https://api.sam.gov/opportunities/v2/search");
      apiUrl.searchParams.set("api_key", apiKey);
      if (noticeId) apiUrl.searchParams.set("noticeid", noticeId);
      else if (solicitationNumber) apiUrl.searchParams.set("solnum", solicitationNumber);
      apiUrl.searchParams.set("postedFrom", fmt(from));
      apiUrl.searchParams.set("postedTo", fmt(to));
      apiUrl.searchParams.set("limit", "1");

      const res = await fetch(apiUrl.toString(), { headers: { Accept: "application/json" } });
      if (!res.ok) {
        lastStatus = res.status;
        lastErrorText = await res.text();
        console.error("SAM.gov API error", res.status, lastErrorText.slice(0, 300));
        // Don't keep hammering on auth/quota errors
        if (res.status === 401 || res.status === 403 || res.status === 429) break;
        continue;
      }
      const json = (await res.json()) as { opportunitiesData?: SamNotice[] };
      if (json.opportunitiesData && json.opportunitiesData.length > 0) {
        notice = json.opportunitiesData[0];
        break;
      }
    }

    if (!notice && lastStatus && (lastStatus === 401 || lastStatus === 403 || lastStatus === 429)) {
      return new Response(
        JSON.stringify({ error: `SAM.gov API returned ${lastStatus}`, detail: lastErrorText.slice(0, 500) }),
        { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

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
      sam_url: notice.uiLink || url || (notice.noticeId ? `https://sam.gov/opp/${notice.noticeId}/view` : undefined),
      notes: notice.description ? notice.description.slice(0, 4000) : undefined,
      attachments: (notice.resourceLinks ?? []).map((href) => ({ href })),
    };

    return new Response(JSON.stringify({ prefill, noticeId: noticeId ?? notice.noticeId ?? null }), {
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
