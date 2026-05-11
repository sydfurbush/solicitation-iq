import { createClient } from "https://esm.sh/@supabase/supabase-js@2.95.0";
import { corsHeaders } from "https://esm.sh/@supabase/supabase-js@2.95.0/cors";

async function getCallerSamKey(req: Request): Promise<{ key?: string; error?: Response }> {
  const authHeader = req.headers.get("Authorization") ?? "";
  const token = authHeader.replace(/^Bearer\s+/i, "").trim();
  if (!token) {
    return {
      error: new Response(
        JSON.stringify({ error: "SAM_KEY_MISSING", message: "Sign in and add your SAM.gov API key in Settings → Integrations." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      ),
    };
  }
  const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
  const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
  const userClient = createClient(SUPABASE_URL, ANON_KEY, {
    global: { headers: { Authorization: `Bearer ${token}` } },
  });
  const { data: userData } = await userClient.auth.getUser();
  const userId = userData?.user?.id;
  if (!userId) {
    return {
      error: new Response(
        JSON.stringify({ error: "UNAUTHENTICATED", message: "Sign in to import from SAM.gov." }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      ),
    };
  }
  const admin = createClient(SUPABASE_URL, SERVICE_KEY);
  const { data: row } = await admin
    .from("user_integrations")
    .select("api_key")
    .eq("user_id", userId)
    .eq("provider", "sam_gov")
    .maybeSingle();
  const key = (row as { api_key?: string } | null)?.api_key?.trim();
  if (!key) {
    return {
      error: new Response(
        JSON.stringify({ error: "SAM_KEY_MISSING", message: "Add your SAM.gov API key in Settings → Integrations." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      ),
    };
  }
  return { key };
}

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
    const keyResult = await getCallerSamKey(req);
    if (keyResult.error) return keyResult.error;
    const apiKey = keyResult.key!;

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

    const parsePositiveInt = (raw: string | undefined, fallback: number, min: number, max: number) => {
      const n = Number.parseInt(raw ?? "", 10);
      if (!Number.isFinite(n) || n < min || n > max) return fallback;
      return n;
    };
    const MAX_YEARS_BACK = parsePositiveInt(Deno.env.get("SAM_BACKFILL_MAX_YEARS"), 6, 1, 25);
    const WINDOW_DAYS = parsePositiveInt(Deno.env.get("SAM_BACKFILL_WINDOW_DAYS"), 364, 1, 365);
    console.log("[sam-import] backfill config", {
      MAX_YEARS_BACK,
      WINDOW_DAYS,
      source: {
        SAM_BACKFILL_MAX_YEARS: Deno.env.get("SAM_BACKFILL_MAX_YEARS") ?? "(unset, default 6)",
        SAM_BACKFILL_WINDOW_DAYS: Deno.env.get("SAM_BACKFILL_WINDOW_DAYS") ?? "(unset, default 364)",
      },
    });

    // Build a prioritized list of identifier strategies to try.
    type Strategy = { kind: "noticeid" | "solnum"; value: string; label: string };
    const strategies: Strategy[] = [];
    const seen = new Set<string>();
    const push = (s: Strategy) => {
      const key = `${s.kind}:${s.value.toLowerCase()}`;
      if (s.value && !seen.has(key)) {
        seen.add(key);
        strategies.push(s);
      }
    };

    if (noticeId) push({ kind: "noticeid", value: noticeId, label: "noticeId from URL" });

    const rawSol = solicitationNumber?.trim();
    if (rawSol) {
      push({ kind: "solnum", value: rawSol, label: "solicitationNumber as-provided" });
      const upper = rawSol.toUpperCase();
      push({ kind: "solnum", value: upper, label: "uppercase" });
      const noSpaces = upper.replace(/\s+/g, "");
      push({ kind: "solnum", value: noSpaces, label: "no spaces" });
      const stripped = noSpaces.replace(/[-_./]/g, "");
      push({ kind: "solnum", value: stripped, label: "stripped punctuation" });
      // Common federal pattern e.g. W9124D-26-R-A001 ↔ W9124D26RA001
      // If the stripped form is alphanumeric, also try inserting a dash after a leading agency code.
      if (stripped.length >= 8 && /^[A-Z0-9]+$/.test(stripped)) {
        const withDashes = stripped.replace(/^([A-Z0-9]{6})(\d{2})([A-Z])([A-Z0-9]+)$/, "$1-$2-$3-$4");
        if (withDashes !== stripped) push({ kind: "solnum", value: withDashes, label: "with dashes" });
      }
    }

    let notice: SamNotice | undefined;
    let lastErrorText = "";
    let lastStatus = 0;
    const attempts: Array<{
      strategy: string;
      kind: string;
      value: string;
      window: number;
      postedFrom: string;
      postedTo: string;
      status: number;
      totalRecords?: number;
      found: boolean;
      error?: string;
    }> = [];

    console.log("[sam-import] lookup start", {
      noticeId,
      solicitationNumber,
      url,
      strategies: strategies.map((s) => ({ kind: s.kind, value: s.value, label: s.label })),
    });

    let matchedStrategy: Strategy | undefined;
    outer: for (const strat of strategies) {
      console.log(`[sam-import] trying strategy "${strat.label}"`, { kind: strat.kind, value: strat.value });
      let fatal = false;
      for (let i = 0; i < MAX_YEARS_BACK; i++) {
        const to = new Date(Date.now() - i * WINDOW_DAYS * 24 * 60 * 60 * 1000);
        const from = new Date(to.getTime() - WINDOW_DAYS * 24 * 60 * 60 * 1000);
        const postedFrom = fmt(from);
        const postedTo = fmt(to);

        const apiUrl = new URL("https://api.sam.gov/opportunities/v2/search");
        apiUrl.searchParams.set("api_key", apiKey);
        apiUrl.searchParams.set(strat.kind, strat.value);
        apiUrl.searchParams.set("postedFrom", postedFrom);
        apiUrl.searchParams.set("postedTo", postedTo);
        apiUrl.searchParams.set("limit", "1");

        const res = await fetch(apiUrl.toString(), { headers: { Accept: "application/json" } });
        if (!res.ok) {
          lastStatus = res.status;
          lastErrorText = await res.text();
          attempts.push({
            strategy: strat.label,
            kind: strat.kind,
            value: strat.value,
            window: i + 1,
            postedFrom,
            postedTo,
            status: res.status,
            found: false,
            error: lastErrorText.slice(0, 200),
          });
          console.error(
            `[sam-import] "${strat.label}" window ${i + 1} HTTP ${res.status}`,
            lastErrorText.slice(0, 300),
          );
          if (res.status === 401 || res.status === 403 || res.status === 429) {
            fatal = true;
            break;
          }
          continue;
        }
        const json = (await res.json()) as { opportunitiesData?: SamNotice[]; totalRecords?: number };
        const totalRecords = json.totalRecords ?? json.opportunitiesData?.length ?? 0;
        const found = (json.opportunitiesData?.length ?? 0) > 0;
        attempts.push({
          strategy: strat.label,
          kind: strat.kind,
          value: strat.value,
          window: i + 1,
          postedFrom,
          postedTo,
          status: res.status,
          totalRecords,
          found,
        });
        console.log(`[sam-import] "${strat.label}" window ${i + 1} result`, { totalRecords, found });
        if (found) {
          notice = json.opportunitiesData![0];
          matchedStrategy = strat;
          break outer;
        }
      }
      if (fatal) break;
    }

    const backfillConfig = { maxYearsBack: MAX_YEARS_BACK, windowDays: WINDOW_DAYS };

    console.log("[sam-import] lookup summary", {
      matched: !!notice,
      matchedStrategy: matchedStrategy?.label,
      totalAttempts: attempts.length,
      backfillConfig,
    });

    if (!notice && lastStatus && (lastStatus === 401 || lastStatus === 403 || lastStatus === 429)) {
      return new Response(
        JSON.stringify({
          error: `SAM.gov API returned ${lastStatus}`,
          detail: lastErrorText.slice(0, 500),
          attempts,
          backfillConfig,
        }),
        { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // Fallback: the v2 opportunities/search endpoint sometimes fails to match by
    // noticeId even when the notice exists (commonly for older notices or
    // contract/award URLs). The noticedesc endpoint accepts a bare noticeId
    // without a date window, so use it to at least confirm the notice exists
    // and extract a description for a minimal prefill.
    let descFallback: { description?: string; status: number; ok: boolean } | null = null;
    if (!notice && noticeId) {
      try {
        const descUrl = new URL("https://api.sam.gov/prod/opportunities/v1/noticedesc");
        descUrl.searchParams.set("api_key", apiKey);
        descUrl.searchParams.set("noticeid", noticeId);
        const descRes = await fetch(descUrl.toString(), { headers: { Accept: "application/json" } });
        const descJson = await descRes.json().catch(() => ({} as { description?: string }));
        descFallback = {
          status: descRes.status,
          ok: descRes.ok && typeof descJson?.description === "string" && descJson.description.length > 0,
          description: descJson?.description,
        };
        console.log("[sam-import] noticedesc fallback", {
          status: descRes.status,
          hasDescription: descFallback.ok,
        });
        if (descFallback.ok) {
          notice = {
            noticeId,
            description: descFallback.description,
            uiLink: url ?? `https://sam.gov/opp/${noticeId}/view`,
          };
          matchedStrategy = { kind: "noticeid", value: noticeId, label: "noticedesc fallback" };
        }
      } catch (e) {
        console.error("[sam-import] noticedesc fallback failed", e);
      }
    }

    if (!notice) {
      return new Response(
        JSON.stringify({
          error: "No SAM.gov notice found for that URL",
          lookup: { noticeId, solicitationNumber },
          triedStrategies: [
            ...strategies.map((s) => s.label),
            ...(descFallback ? [`noticedesc fallback (status ${descFallback.status})`] : []),
          ],
          attempts,
          backfillConfig,
        }),
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
