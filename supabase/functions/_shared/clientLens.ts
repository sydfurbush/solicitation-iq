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
    lines.push("**Always-flag rules — MANDATORY. If any of these conditions appear (or plausibly apply) in the solicitation, you MUST surface them explicitly as critical findings/risks in your output, even if the user did not ask. Do not omit. Quote the triggering language when possible:**");
    flags.forEach((f) => {
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

  // ---- Utility-supplier context (only renders when fields are populated) ----
  const m = merged as Record<string, unknown>;
  const svcCats = asArray(m.service_categories);
  const regBodies = asArray(m.regulatory_bodies);
  const isoRto = (m.iso_rto as string | null) ?? null;
  const deliveryModels = asArray(m.delivery_models);

  const utilityActive =
    svcCats.length > 0 ||
    regBodies.length > 0 ||
    !!isoRto ||
    deliveryModels.length > 0 ||
    (m.preset_key && String(m.preset_key).startsWith("utility_"));

  if (utilityActive) {
    lines.push("");
    lines.push("**Utility-supplier context** — this client sells into the utility industry. Apply utility-specific norms (NERC CIP, NESC, PHMSA, AWWA, OSHA 1910.269, EEI mutual-aid) where relevant.");
    if (svcCats.length) lines.push(`  - Service categories: ${svcCats.join(", ")}`);
    if (regBodies.length) lines.push(`  - Regulatory bodies: ${regBodies.join(", ")}`);
    if (isoRto) lines.push(`  - ISO/RTO: ${isoRto}`);
    if (deliveryModels.length) lines.push(`  - Delivery models offered: ${deliveryModels.join(", ")}`);

    const territory = (m.service_territory ?? {}) as Record<string, unknown>;
    const tStates = asArray(territory.states);
    const tDivs = asArray(territory.divisions);
    if (tStates.length || tDivs.length) {
      const parts: string[] = [];
      if (tStates.length) parts.push(`states: ${tStates.join(", ")}`);
      if (tDivs.length) parts.push(`divisions: ${tDivs.join(", ")}`);
      lines.push(`  - Service territory — ${parts.join(" · ")}`);
    }

    const buyers = (m.buyer_relationships ?? {}) as Record<string, unknown>;
    const bList = asArray(buyers.buyers);
    const prequals = asArray(buyers.prequal_platforms);
    if (bList.length) lines.push(`  - Known buyers / current MSAs: ${bList.join(", ")}`);
    if (prequals.length) lines.push(`  - Prequalification platforms held: ${prequals.join(", ")}`);

    const safety = (m.safety_metrics ?? {}) as Record<string, unknown>;
    const safetyParts: string[] = [];
    if (safety.trir != null) safetyParts.push(`TRIR ${safety.trir}`);
    if (safety.dart != null) safetyParts.push(`DART ${safety.dart}`);
    if (safety.emr != null) safetyParts.push(`EMR ${safety.emr}`);
    if (safety.mutual_aid) safetyParts.push(`mutual-aid: ${String(safety.mutual_aid).slice(0, 200)}`);
    if (safetyParts.length) lines.push(`  - Safety metrics: ${safetyParts.join(" · ")}`);

    const wf = (m.workforce_capacity ?? {}) as Record<string, unknown>;
    const wfEntries = Object.entries(wf).filter(([, v]) => v != null && v !== "");
    if (wfEntries.length) {
      lines.push(`  - Workforce & capacity: ${wfEntries.slice(0, 12).map(([k, v]) => `${k}=${v}`).join(", ")}`);
    }

    const div = (m.diversity_tiers ?? {}) as Record<string, unknown>;
    const certs = asArray(div.certifications);
    const tierIds = asArray(div.utility_tier_ids);
    if (certs.length) lines.push(`  - Diversity certifications: ${certs.join(", ")}`);
    if (tierIds.length) lines.push(`  - Utility supplier tier IDs: ${tierIds.join(", ")}`);

    const bonding = (m.bonding ?? {}) as Record<string, unknown>;
    const bondParts: string[] = [];
    if (bonding.single) bondParts.push(`single ${bonding.single}`);
    if (bonding.aggregate) bondParts.push(`aggregate ${bonding.aggregate}`);
    const cov = asArray(bonding.coverages);
    if (cov.length) bondParts.push(`coverages: ${cov.join(", ")}`);
    if (bondParts.length) lines.push(`  - Bonding & insurance: ${bondParts.join(" · ")}`);

    const labor = (m.labor_posture ?? {}) as Record<string, unknown>;
    const unions = asArray(labor.unions);
    if (unions.length || labor.prevailing_wage || labor.pla_experience) {
      const lp: string[] = [];
      if (unions.length) lp.push(`unions: ${unions.join(", ")}`);
      if (labor.prevailing_wage) lp.push("prevailing-wage experience");
      if (labor.pla_experience) lp.push("PLA experience");
      lines.push(`  - Labor posture: ${lp.join(" · ")}`);
    }

    const storm = (m.storm_response ?? {}) as Record<string, unknown>;
    const smag = asArray(storm.mutual_aid_groups);
    if (smag.length || storm.sla || storm.staging) {
      const sp: string[] = [];
      if (smag.length) sp.push(`groups: ${smag.join(", ")}`);
      if (storm.sla) sp.push(`SLA: ${storm.sla}`);
      if (storm.staging) sp.push(`staging: ${storm.staging}`);
      lines.push(`  - Storm/emergency response: ${sp.join(" · ")}`);
    }

    const tech = (m.tech_stack ?? {}) as Record<string, unknown>;
    const techEntries = Object.entries(tech).filter(([, v]) => v);
    if (techEntries.length) {
      lines.push(`  - Tech stack: ${techEntries.slice(0, 10).map(([k, v]) => `${k}=${v}`).join(", ")}`);
    }

    // ---- Lane-aware utility topic nudges (Phase 2) ----
    const presetKeyForLane = String((merged as { preset_key?: string | null }).preset_key ?? "");
    const lane: string =
      presetKeyForLane.startsWith("utility_it_ot") ? "it_ot"
      : presetKeyForLane.startsWith("utility_engineering") ? "engineering"
      : presetKeyForLane.startsWith("utility_electric_construction") ? "electric"
      : presetKeyForLane.startsWith("utility_gas_construction") ? "gas"
      : presetKeyForLane.startsWith("utility_water_construction") ? "water"
      : presetKeyForLane.startsWith("utility_civil_construction") ? "civil"
      : presetKeyForLane.startsWith("utility_renewables_epc") ? "renewables"
      : presetKeyForLane.startsWith("utility_staffing") ? "staffing"
      : presetKeyForLane.startsWith("utility_professional_services") ? "prof_services"
      : presetKeyForLane.startsWith("utility_field_services") ? "field_services"
      : presetKeyForLane.startsWith("utility_equipment") ? "equipment"
      : "generic";
    const nudge = renderUtilityTopicNudge(opts.topic, lane);
    if (nudge) {
      lines.push("");
      lines.push(nudge);
    }
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

// ============================================================================
// Phase 2: Utility lane-aware topic nudges
// Returns extra prompt instructions for a given (topic, lane) combination so
// every analysis function automatically gets utility-aware extraction & framing.
// ============================================================================
function renderUtilityTopicNudge(topic: LensTopic, lane: string): string {
  const lanes: Record<string, Record<string, string[]>> = {
    requirements: {
      it_ot: [
        "Extract NERC CIP impact rating (Low/Medium/High BES Cyber System), CIP-002 through CIP-014 obligations, IEC 62443 SL targets, OT/ICS network segmentation requirements, patch-management windows, and any TSA Pipeline Cybersecurity Directive citations.",
      ],
      engineering: [
        "Extract PE-stamp jurisdictions, design standards (IEEE, ANSI, ASCE 7, ACI 318, AWWA, ASME B31.8/B31.4), deliverable phases (30/60/90/IFC), and any utility-specific design guides (e.g., RUS Bulletins).",
      ],
      electric: [
        "Extract voltage class (distribution / sub-transmission / transmission kV), OSHA 1910.269 + NFPA 70E arc-flash boundaries, minimum approach distance (MAD), EEI 587 storm-restoration posture, OQ/qualified-electrical-worker requirements, Davis-Bacon/PLA, and Buy America/BABA on IIJA-funded work.",
      ],
      gas: [
        "Extract PHMSA 49 CFR Part 192 obligations, DIMP/TIMP, OQ-covered tasks, MAOP/class-location, leak-survey grade, HCA proximity, welding qualifications (API 1104, ASME IX), and pipeline integrity-management deliverables.",
      ],
      water: [
        "Extract AWWA standards (C600 ductile iron, C810 LCRR service-line inventory, C651 disinfection), EPA SDWA/LCRR/PFAS triggers, NSF 61/372 material requirements, GPM/MGD plant capacity, and any state primacy-agency requirements.",
      ],
      civil: [
        "Extract USACE Section 404, CWA Section 401, NPDES/SWPPP, ROW/easement scope, traffic-control (MUTCD), erosion control, and any prevailing-wage / Davis-Bacon triggers.",
      ],
      renewables: [
        "Extract interconnection queue requirements (FERC LGIA/SGIA, ISO/RTO study phase), IRA domestic-content & PWA bonus thresholds, IEEE 1547, UL 3741, BESS NFPA 855, and EPC delivery milestones (NTP, MC, COD).",
      ],
      staffing: [
        "Extract VMS/MSP platform (Fieldglass, Beeline, IQNavigator), rate-card / bill-rate caps, tenure limits, OQ/CDL/medical requirements, background/MVR/drug-screen panels, and any union/CBA-covered classifications.",
      ],
      prof_services: [
        "Extract LCAT mappings, key-personnel resume/clearance requirements, CMMI/ISO certification floors, deliverable acceptance criteria, and any state PUC docket-support obligations.",
      ],
      field_services: [
        "Extract response-time SLAs, on-call rotation, OQ-covered tasks, vehicle/tool requirements, ISN/Avetta/Veriforce prequal grade, and storm/mutual-aid call-out terms.",
      ],
      equipment: [
        "Extract product spec compliance (IEEE/ANSI/AWWA/ASME), Buy America/BABA & domestic-content thresholds, FAT/SAT requirements, lead-time commitments, stocking/consignment/VMI terms, and warranty/RMA SLAs.",
      ],
      generic: [
        "Extract regulatory regime (NERC/PHMSA/EPA/PUC/ISO-RTO), prequalification platform required, delivery model (MSA/T&M/EPC/unit-price), bonding/insurance limits, and any Buy America/BABA or prevailing-wage triggers.",
      ],
    },
    risks: {
      it_ot: ["Flag NERC CIP scope mismatch, OT/ICS segmentation gaps, vendor-remote-access posture, and SBOM/EO 14028 obligations."],
      engineering: ["Flag PE-jurisdiction coverage gaps, missing utility-specific design-guide compliance, and aggressive IFC schedules vs. review cycles."],
      electric: ["Flag outage-window liquidated damages, MAD/arc-flash posture vs. crew certifications, storm-call-out exposure, and Buy America compliance on IIJA work."],
      gas: ["Flag DIMP/TIMP gaps, OQ task coverage, HCA exposure, and welder-qualification continuity."],
      water: ["Flag LCRR inventory deadlines, PFAS treatment retrofit risk, NSF 61 material substitution risk, and bypass-pumping/shutdown-window exposure."],
      civil: ["Flag permit-acquisition risk (404/401/NPDES), unsuitable-soils risk, and traffic-control plan adequacy."],
      renewables: ["Flag interconnection-study delay, domestic-content shortfall (IRA bonus loss), BESS fire-code compliance, and supply-chain lead-time risk."],
      staffing: ["Flag rate-card margin compression, tenure-limit churn, OQ/credential ramp time, and co-employment exposure."],
      prof_services: ["Flag key-personnel commitment risk, clearance-ramp, and PUC docket-schedule slip."],
      field_services: ["Flag SLA penalty exposure, prequal-grade gap, and storm-overlap capacity risk."],
      equipment: ["Flag domestic-content/BABA non-compliance, FAT/SAT acceptance risk, and lead-time vs. ICD risk."],
      generic: ["Flag regulatory-regime mismatch, prequal grade gap, bonding capacity gap, delivery-model mismatch, and Buy America/PWA exposure."],
    },
    win_themes: {
      it_ot: ["Bias themes toward NERC CIP audit history, OT/ICS reference architectures, ISO 27001/SOC 2, and utility-specific deployments cited by name."],
      engineering: ["Bias themes toward PE density by jurisdiction, repeat utility-design awards, and on-time IFC delivery record."],
      electric: ["Bias themes toward TRIR/EMR vs. industry, EEI mutual-aid history, local crew/line-truck density, and self-perform percentage."],
      gas: ["Bias themes toward OQ-task breadth, integrity-management track record, and zero-PHMSA-incident streaks."],
      water: ["Bias themes toward AWWA accreditations, LCRR program experience, and successful PFAS/disinfection retrofits."],
      civil: ["Bias themes toward self-perform civil capacity, SWPPP/erosion record, and on-budget delivery in similar terrain."],
      renewables: ["Bias themes toward EPC schedule certainty, domestic-content sourcing, BESS commissioning record, and IRA-bonus eligibility."],
      staffing: ["Bias themes toward bench depth in OQ/CDL/clearance categories, fill-rate / time-to-fill, and VMS/MSP performance scores."],
      prof_services: ["Bias themes toward named subject-matter experts, regulatory-filing wins, and benchmarking datasets."],
      field_services: ["Bias themes toward SLA attainment, prequal grade tier, and 24x7 dispatch readiness."],
      equipment: ["Bias themes toward domestic-content posture, FAT pass rate, on-time delivery, and warranty performance."],
      generic: ["Bias themes toward safety record, certification tier, local presence, and buyer-specific past performance."],
    },
    gaps: {
      generic: ["Compare requirements to utility-supplier profile fields (service_categories, regulatory_bodies, delivery_models, bonding, prequal platforms, safety metrics, workforce capacity, diversity tiers, labor posture). Flag any required-but-absent capability."],
    },
    comparison: {
      generic: ["Surface deltas in regulatory regime (NERC/PHMSA/EPA/PUC), prequalification platform, delivery model (MSA/T&M/EPC/unit-price), bonding/insurance, Buy America/PWA, and outage/SLA structure."],
    },
    outline: {
      generic: ["If utility-buyer norms apply, ensure outline includes Safety, Quality (QA/QC), Regulatory Compliance, Local Presence / Mutual Aid, and Diversity/Tier sections in addition to Technical, Management, and Past Performance."],
    },
    questions: {
      generic: ["Include questions probing: applicable regulatory regime, required prequal platform & grade, delivery model, bonding/insurance limits, Buy America/PWA applicability, outage windows & LDs, and whether incumbent self-performs."],
    },
    analysis: {
      generic: ["Apply utility-supplier framing: identify regulatory regime, delivery model, prequal platform, and any Buy America/PWA triggers up front."],
    },
    report: {
      generic: ["Include a Utility Bid Snapshot perspective where regulatory regime, prequal grade, bonding, safety vs. EMR/TRIR, and delivery-model fit are explicitly addressed."],
    },
  };

  const topicMap = lanes[topic];
  if (!topicMap) return "";
  const items = topicMap[lane] ?? topicMap["generic"];
  if (!items || !items.length) return "";
  return ["**Utility lane guidance** — apply automatically:", ...items.map((s) => `  - ${s}`)].join("\n");
}
