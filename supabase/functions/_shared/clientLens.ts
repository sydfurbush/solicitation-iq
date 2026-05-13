// Shared helper: builds the "Client Lens" prompt block prepended to every
// AI analysis function. Profile + RAG retrieval over the client knowledge library.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { embedQuery } from "./embeddings.ts";

export interface LensCitation {
  chunk_id: string;
  document_id: string;
  document_title: string;
  chunk_index: number;
  snippet: string;
  similarity: number;
  source_type: string;
  source_url?: string | null;
  tags?: string[] | null;
}

export interface LensSnapshot {
  preset_key: string | null;
  label: string | null;
  version: number;
  overridden: boolean;
  topic: string;
  captured_at: string;
  knowledge_doc_ids?: string[];
  knowledge_count?: number;
}

export interface BuildLensResult {
  promptBlock: string;
  lensVersion: number | null;
  citations: LensCitation[];
  snapshot: LensSnapshot | null;
}

export type LensTopic =
  | "win_themes"
  | "requirements"
  | "questions"
  | "gaps"
  | "outline"
  | "risks"
  | "analysis"
  | "report"
  | "comparison";

interface BuildOptions {
  topic: LensTopic;
  query?: string;
  topK?: number;
  override?: Record<string, unknown> | null;
}

function admin() {
  return createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    { auth: { persistSession: false } },
  );
}

function asArray(v: unknown): string[] {
  return Array.isArray(v) ? (v as string[]).filter((x) => typeof x === "string" && x.length) : [];
}

export async function getClientIdForSolicitation(solicitationId: string): Promise<string | null> {
  const sb = admin();
  const { data } = await sb.from("solicitations").select("client_id").eq("id", solicitationId).maybeSingle();
  return data?.client_id ?? null;
}

export async function buildClientLens(
  clientId: string | null | undefined,
  opts: BuildOptions,
): Promise<BuildLensResult> {
  if (!clientId) {
    return { promptBlock: "", lensVersion: null, citations: [], snapshot: null };
  }
  const sb = admin();
  const { data: profile } = await sb
    .from("client_profiles")
    .select("*")
    .eq("client_id", clientId)
    .maybeSingle();

  if (!profile) {
    return {
      promptBlock: "## Client Lens\n(No client lens configured. Use general best-practice judgment.)\n",
      lensVersion: null,
      citations: [],
      snapshot: null,
    };
  }

  // Apply per-solicitation override (sparse merge).
  const merged = { ...profile, ...(opts.override ?? {}) } as typeof profile;

  const lines: string[] = [];
  lines.push("## Client Lens");
  lines.push(`This analysis is for a client whose profile is defined below. Tailor every output to fit it.`);
  lines.push("");

  const codes: string[] = [];
  if (asArray(merged.naics_codes).length) codes.push(`NAICS: ${asArray(merged.naics_codes).join(", ")}`);
  if (asArray(merged.psc_codes).length) codes.push(`PSC: ${asArray(merged.psc_codes).join(", ")}`);
  if (asArray(merged.set_asides).length) codes.push(`Set-asides: ${asArray(merged.set_asides).join(", ")}`);
  if (codes.length) lines.push(`**Identity & codes** — ${codes.join(" · ")}`);

  if (asArray(merged.agencies_focus).length)
    lines.push(`**Agencies of focus** — ${asArray(merged.agencies_focus).join(", ")}`);
  if (asArray(merged.contract_vehicles).length)
    lines.push(`**Preferred vehicles** — ${asArray(merged.contract_vehicles).join(", ")}`);
  if (asArray(merged.compliance_frameworks).length)
    lines.push(`**Compliance frameworks** — ${asArray(merged.compliance_frameworks).join(", ")}. Treat any conflict with these as a critical risk.`);

  const discriminators = (merged.discriminators as Array<{ title: string; evidence: string; proof_point: string }> | null) ?? [];
  if (discriminators.length) {
    lines.push("");
    lines.push("**Discriminators (weave into win-related output):**");
    discriminators.forEach((d, i) => {
      if (d.title) lines.push(`  ${i + 1}. ${d.title}${d.evidence ? ` — ${d.evidence}` : ""}${d.proof_point ? ` (proof: ${d.proof_point})` : ""}`);
    });
  }

  const flags = (merged.always_flag as Array<{ rule: string; reason: string }> | null) ?? [];
  if (flags.length) {
    lines.push("");
    lines.push("**Always-flag rules — surface as critical findings whenever present:**");
    flags.forEach((f, i) => {
      if (f.rule) lines.push(`  - ${f.rule}${f.reason ? ` — ${f.reason}` : ""}`);
    });
  }

  const glossary = (merged.acronym_glossary as Record<string, string> | null) ?? {};
  const glossaryEntries = Object.entries(glossary).filter(([k]) => k.trim());
  if (glossaryEntries.length) {
    lines.push("");
    lines.push("**Acronym glossary** — interpret these correctly and expand on first use:");
    glossaryEntries.slice(0, 40).forEach(([k, v]) => lines.push(`  - ${k}: ${v}`));
  }

  if (merged.tone_voice) {
    lines.push("");
    lines.push(`**Voice** — ${merged.tone_voice}; reading-level grade ${merged.reading_level ?? 12}.`);
  }
  if (merged.extra_notes) {
    lines.push("");
    lines.push(`**Additional context** — ${String(merged.extra_notes).slice(0, 1500)}`);
  }

  // ---- Client Knowledge (RAG) -------------------------------------------------
  const citations: LensCitation[] = [];
  const knowledgeDocIds: string[] = [];
  if (opts.query && opts.query.trim().length > 0) {
    try {
      const vec = await embedQuery(opts.query);
      if (vec) {
        const { data: matches, error: matchErr } = await sb.rpc("match_client_knowledge", {
          p_client_id: clientId,
          p_query_embedding: vec as unknown as string,
          p_match_count: opts.topK ?? 5,
          p_min_similarity: 0.3,
        });
        if (matchErr) {
          console.warn("[buildClientLens] match rpc failed:", matchErr.message);
        } else if (Array.isArray(matches) && matches.length > 0) {
          for (const m of matches as Array<{
            chunk_id: string;
            document_id: string;
            document_title: string;
            chunk_index: number;
            content: string;
            similarity: number;
            source_type: string;
            source_url: string | null;
            tags: string[] | null;
          }>) {
            citations.push({
              chunk_id: m.chunk_id,
              document_id: m.document_id,
              document_title: m.document_title,
              chunk_index: m.chunk_index,
              snippet: m.content,
              similarity: m.similarity,
              source_type: m.source_type,
              source_url: m.source_url,
              tags: m.tags,
            });
            if (!knowledgeDocIds.includes(m.document_id)) knowledgeDocIds.push(m.document_id);
          }
        }
      }
    } catch (e) {
      console.warn("[buildClientLens] knowledge retrieval failed:", e instanceof Error ? e.message : e);
    }
  }

  if (citations.length) {
    lines.push("");
    lines.push("## Client Knowledge (retrieved excerpts — cite with [K#] when used)");
    citations.forEach((c, i) => {
      const tag = `K${i + 1}`;
      lines.push(`- [${tag}] **${c.document_title}** (chunk ${c.chunk_index}, sim ${c.similarity.toFixed(2)})`);
      lines.push(`  > ${c.snippet.replace(/\n+/g, " ").slice(0, 700)}`);
    });
  }

  lines.push("");
  lines.push(`(Lens version: v${merged.version ?? 1}. Topic: ${opts.topic}. Knowledge sources: ${citations.length}.)`);
  lines.push("");

  const overridden = !!opts.override && Object.keys(opts.override).length > 0;
  const presetKey = (profile as { preset_key?: string | null }).preset_key ?? null;
  const version = (merged.version as number | undefined) ?? 1;

  return {
    promptBlock: lines.join("\n"),
    lensVersion: version,
    citations,
    snapshot: {
      preset_key: presetKey,
      label: null,
      version,
      overridden,
      topic: opts.topic,
      captured_at: new Date().toISOString(),
      knowledge_doc_ids: knowledgeDocIds,
      knowledge_count: citations.length,
    },
  };
}
