import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import {
  Document, Packer, Paragraph, TextRun, HeadingLevel, AlignmentType, PageBreak, Footer, PageNumber,
} from "npm:docx@8.5.0";
import { isRequirementCited, stripCitationTags } from "../_shared/requirementLinks.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

interface Profile {
  font: string;
  size_pt: number;
  margins_in: number;
  line_spacing: number;
  page_number_format: string;
  volume_page_limits: Record<string, number>;
  file_name_pattern: string;
  vertical: string;
  name: string;
}

const DEFAULT_PROFILE: Profile = {
  font: "Times New Roman",
  size_pt: 12,
  margins_in: 1.0,
  line_spacing: 1.0,
  page_number_format: "{volume} - {page} of {pages}",
  volume_page_limits: {},
  file_name_pattern: "{firm}_{solnumber}_{volume}",
  vertical: "federal",
  name: "Federal Default",
};

function mdLineToParagraph(line: string, profile: Profile): Paragraph {
  const fontSize = profile.size_pt * 2; // half-points
  const headingMatch = line.match(/^(#{1,4})\s+(.*)$/);
  if (headingMatch) {
    const level = headingMatch[1].length;
    const text = headingMatch[2];
    const headingMap = [HeadingLevel.HEADING_1, HeadingLevel.HEADING_2, HeadingLevel.HEADING_3, HeadingLevel.HEADING_4];
    return new Paragraph({
      heading: headingMap[level - 1],
      children: [new TextRun({ text, bold: true, font: profile.font, size: fontSize + (5 - level) * 2 })],
      spacing: { before: 200, after: 120 },
    });
  }
  if (line.startsWith("- ") || line.startsWith("* ")) {
    return new Paragraph({
      bullet: { level: 0 },
      children: [new TextRun({ text: line.slice(2), font: profile.font, size: fontSize })],
    });
  }
  return new Paragraph({
    children: parseInline(line, profile.font, fontSize),
    spacing: { line: Math.round(profile.line_spacing * 240) },
  });
}

function parseInline(text: string, font: string, size: number): TextRun[] {
  // Split bold **...**
  const parts: TextRun[] = [];
  const regex = /\*\*(.+?)\*\*/g;
  let last = 0;
  let m: RegExpExecArray | null;
  while ((m = regex.exec(text)) !== null) {
    if (m.index > last) parts.push(new TextRun({ text: text.slice(last, m.index), font, size }));
    parts.push(new TextRun({ text: m[1], font, size, bold: true }));
    last = m.index + m[0].length;
  }
  if (last < text.length) parts.push(new TextRun({ text: text.slice(last), font, size }));
  return parts.length ? parts : [new TextRun({ text: " ", font, size })];
}

function markdownToParagraphs(md: string, profile: Profile): Paragraph[] {
  const out: Paragraph[] = [];
  // [Req-X] and [K#] tags are internal tracking marks; keep them out of the submission document.
  const lines = stripCitationTags(md).split("\n");
  for (const raw of lines) {
    const line = raw.trimEnd();
    if (!line) {
      out.push(new Paragraph({ children: [new TextRun(" ")] }));
    } else {
      out.push(mdLineToParagraph(line, profile));
    }
  }
  return out;
}

function inchToTwip(inches: number): number {
  return Math.round(inches * 1440);
}

async function buildVolumeDocx(volumeName: string, sections: Array<{ node: any; draft: any }>, solicitation: any, profile: Profile): Promise<Uint8Array> {
  const margin = inchToTwip(profile.margins_in);
  const fontSize = profile.size_pt * 2;

  const titleChildren: Paragraph[] = [
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { before: 2400, after: 240 },
      children: [new TextRun({ text: solicitation?.title ?? "Proposal", bold: true, size: 48, font: profile.font })],
    }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { after: 240 },
      children: [new TextRun({ text: `Volume: ${volumeName}`, bold: true, size: 32, font: profile.font })],
    }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      children: [new TextRun({ text: solicitation?.solicitation_number ?? "", size: fontSize, font: profile.font })],
    }),
    new Paragraph({ children: [new PageBreak()] }),
  ];

  // Table of contents (simple text-based)
  const tocChildren: Paragraph[] = [
    new Paragraph({
      heading: HeadingLevel.HEADING_1,
      children: [new TextRun({ text: "Table of Contents", bold: true, font: profile.font, size: 36 })],
      spacing: { after: 240 },
    }),
    ...sections.map((s) => new Paragraph({
      children: [new TextRun({ text: `${s.node.section_number ? s.node.section_number + " — " : ""}${s.node.title}`, font: profile.font, size: fontSize })],
      spacing: { after: 80 },
    })),
    new Paragraph({ children: [new PageBreak()] }),
  ];

  const bodyChildren: Paragraph[] = [];
  for (const s of sections) {
    bodyChildren.push(new Paragraph({
      heading: HeadingLevel.HEADING_1,
      children: [new TextRun({ text: `${s.node.section_number ? s.node.section_number + " " : ""}${s.node.title}`, bold: true, font: profile.font, size: 36 })],
      spacing: { before: 360, after: 200 },
    }));
    if (s.node.source_l_reference) {
      bodyChildren.push(new Paragraph({
        children: [new TextRun({ text: `(Section L reference: ${s.node.source_l_reference})`, italics: true, size: fontSize - 2, font: profile.font })],
        spacing: { after: 120 },
      }));
    }
    const md = s.draft?.content_html || (s.draft?.content_json?.markdown as string) || "*[Section not yet drafted]*";
    bodyChildren.push(...markdownToParagraphs(md, profile));
    bodyChildren.push(new Paragraph({ children: [new PageBreak()] }));
  }

  const doc = new Document({
    creator: "Solicitation IQ",
    title: `${solicitation?.title ?? "Proposal"} – ${volumeName}`,
    styles: { default: { document: { run: { font: profile.font, size: fontSize } } } },
    sections: [{
      properties: {
        page: {
          size: { width: 12240, height: 15840 },
          margin: { top: margin, right: margin, bottom: margin, left: margin },
        },
      },
      footers: {
        default: new Footer({
          children: [new Paragraph({
            alignment: AlignmentType.CENTER,
            children: [
              new TextRun({ text: `${volumeName} — Page `, font: profile.font, size: fontSize - 4 }),
              new TextRun({ children: [PageNumber.CURRENT], font: profile.font, size: fontSize - 4 }),
              new TextRun({ text: " of ", font: profile.font, size: fontSize - 4 }),
              new TextRun({ children: [PageNumber.TOTAL_PAGES], font: profile.font, size: fontSize - 4 }),
            ],
          })],
        }),
      },
      children: [...titleChildren, ...tocChildren, ...bodyChildren],
    }],
  });

  const buffer = await Packer.toBuffer(doc);
  return new Uint8Array(buffer);
}

function preFlight(volumeName: string, sections: Array<{ node: any; draft: any }>, profile: Profile, requirements: any[]) {
  const issues: Array<{ severity: "error" | "warning"; message: string }> = [];
  const limit = profile.volume_page_limits?.[volumeName];
  const totalPages = sections.reduce((acc, s) => acc + Number(s.draft?.page_estimate ?? 0), 0);
  if (limit && totalPages > limit) {
    issues.push({ severity: "error", message: `Estimated ${totalPages} pages exceeds page limit of ${limit} for volume "${volumeName}"` });
  }
  const undrafted = sections.filter((s) => !s.draft || !(s.draft.content_html ?? "").trim());
  if (undrafted.length) {
    issues.push({ severity: "warning", message: `${undrafted.length} section(s) have no draft content` });
  }
  const notFinal = sections.filter((s) => s.draft && !["final", "gold_review"].includes(s.node.writing_status));
  if (notFinal.length) {
    issues.push({ severity: "warning", message: `${notFinal.length} section(s) are not yet at final status` });
  }
  // Compliance: any requirement linked to this volume's nodes that isn't in any draft text
  const allText = sections.map((s) => (s.draft?.content_html ?? "")).join("\n");
  const missing = requirements.filter((r) => !isRequirementCited(allText, r.req_number));
  if (missing.length) {
    issues.push({ severity: "warning", message: `${missing.length} linked requirement(s) not cited in any draft (tag form [Req-X])` });
  }
  return { totalPages, pageLimit: limit ?? null, issues, pass: !issues.some((i) => i.severity === "error") };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const { solicitationId } = await req.json();
    if (!solicitationId) {
      return new Response(JSON.stringify({ error: "solicitationId required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const supabase = createClient(SUPABASE_URL, SERVICE_KEY);

    const { data: sol } = await supabase.from("solicitations")
      .select("id, title, solicitation_number, client_id, format_profile_id, clients!inner(name, organization_id)")
      .eq("id", solicitationId).maybeSingle();
    if (!sol) {
      return new Response(JSON.stringify({ error: "Solicitation not found" }), {
        status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const orgId = (sol as any).clients.organization_id;
    const firmName = (sol as any).clients.name ?? "Firm";

    let profile: Profile = DEFAULT_PROFILE;
    if ((sol as any).format_profile_id) {
      const { data: p } = await supabase.from("buyer_format_profiles").select("*").eq("id", (sol as any).format_profile_id).maybeSingle();
      if (p) profile = p as unknown as Profile;
    } else {
      const { data: p } = await supabase.from("buyer_format_profiles").select("*").eq("organization_id", orgId).eq("is_default", true).maybeSingle();
      if (p) profile = p as unknown as Profile;
    }

    const { data: outline } = await supabase.from("proposal_outlines").select("id").eq("solicitation_id", solicitationId).eq("is_active", true).maybeSingle();
    if (!outline) throw new Error("No active outline");

    const { data: nodes } = await supabase.from("outline_nodes").select("*").eq("outline_id", outline.id).order("sort_order");
    const { data: drafts } = await supabase.from("proposal_drafts").select("*").eq("solicitation_id", solicitationId);
    const draftMap = new Map((drafts ?? []).map((d) => [d.outline_node_id, d]));
    const { data: requirements } = await supabase.from("requirement_items").select("id, req_number").eq("solicitation_id", solicitationId);

    const volumes = new Map<string, Array<{ node: any; draft: any }>>();
    for (const n of nodes ?? []) {
      const vol = n.volume || "Volume I";
      if (!volumes.has(vol)) volumes.set(vol, []);
      volumes.get(vol)!.push({ node: n, draft: draftMap.get(n.id) ?? null });
    }

    const packages: Array<Record<string, unknown>> = [];
    for (const [volumeName, sections] of volumes.entries()) {
      // Filter requirements that touch this volume
      const reqIdsInVol = new Set<string>();
      for (const s of sections) for (const id of (s.node.linked_requirement_ids ?? [])) reqIdsInVol.add(id);
      const reqsInVol = (requirements ?? []).filter((r) => reqIdsInVol.has(r.id));

      const docBytes = await buildVolumeDocx(volumeName, sections, sol, profile);
      const safeVol = volumeName.replace(/[^a-zA-Z0-9]+/g, "_");
      const safeSol = (sol.solicitation_number ?? sol.id).replace(/[^a-zA-Z0-9]+/g, "_");
      const safeFirm = firmName.replace(/[^a-zA-Z0-9]+/g, "_");
      const fileName = profile.file_name_pattern
        .replace("{firm}", safeFirm)
        .replace("{solnumber}", safeSol)
        .replace("{volume}", safeVol) + ".docx";
      const path = `proposals/${solicitationId}/${safeVol}/${fileName}`;

      const { error: upErr } = await supabase.storage.from("reports").upload(path, docBytes, {
        contentType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        upsert: true,
      });
      if (upErr) throw upErr;

      const pf = preFlight(volumeName, sections, profile, reqsInVol);
      const { data: pkg, error: pkgErr } = await supabase.from("proposal_packages").insert({
        solicitation_id: solicitationId,
        kind: "volume_docx",
        volume: volumeName,
        storage_path: path,
        byte_size: docBytes.byteLength,
        pre_flight_pass: pf.pass,
        pre_flight_report: pf,
      }).select().single();
      if (pkgErr) throw pkgErr;
      packages.push(pkg);
    }

    await supabase.from("activity_log").insert({
      solicitation_id: solicitationId,
      event_type: "proposal_compiled",
      event_description: `Compiled ${packages.length} volume(s) using profile "${profile.name}"`,
      entity_type: "proposal_package",
      metadata: { volume_count: packages.length, profile: profile.name },
    }).catch(() => null);

    return new Response(JSON.stringify({ packages, profile_name: profile.name }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("[compile-proposal]", err);
    const msg = err instanceof Error ? err.message : String(err);
    return new Response(JSON.stringify({ error: msg }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
