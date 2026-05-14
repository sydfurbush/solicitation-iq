import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

// Backfill source_document_sections on outline_nodes by matching their
// source_l_reference + section_number against existing document_sections.
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

    const { data: outline } = await supabase
      .from("proposal_outlines")
      .select("id")
      .eq("solicitation_id", solicitationId)
      .eq("is_active", true)
      .order("version", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (!outline) {
      return new Response(JSON.stringify({ error: "No active outline" }), {
        status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: nodes } = await supabase
      .from("outline_nodes")
      .select("id, section_number, source_l_reference, title")
      .eq("outline_id", outline.id);

    const { data: documents } = await supabase
      .from("documents")
      .select("id, file_name")
      .eq("solicitation_id", solicitationId)
      .is("deleted_at", null);
    const docIds = (documents ?? []).map((d) => d.id);
    const docName = new Map((documents ?? []).map((d) => [d.id, d.file_name] as const));

    const { data: sections } = docIds.length ? await supabase
      .from("document_sections")
      .select("document_id, section_number, section_title, page_start")
      .in("document_id", docIds) : { data: [] };

    const norm = (s: string | null | undefined) =>
      (s ?? "").toLowerCase().replace(/[^a-z0-9.]/g, "");

    let updated = 0;
    for (const node of nodes ?? []) {
      const candidates: string[] = [];
      if (node.source_l_reference) candidates.push(node.source_l_reference);
      if (node.section_number) candidates.push(node.section_number);
      const matches = (sections ?? []).filter((s) => {
        const sn = norm(s.section_number);
        if (!sn) return false;
        return candidates.some((c) => {
          const cn = norm(c);
          return cn && (sn === cn || sn.startsWith(cn) || cn.startsWith(sn));
        });
      }).slice(0, 5).map((s) => ({
        document_id: s.document_id,
        document_name: docName.get(s.document_id) ?? null,
        section_number: s.section_number,
        section_title: s.section_title,
        page_start: s.page_start,
      }));
      if (matches.length === 0) continue;
      const { error } = await supabase
        .from("outline_nodes")
        .update({ source_document_sections: matches })
        .eq("id", node.id);
      if (!error) updated++;
    }

    return new Response(JSON.stringify({ success: true, updated, total: nodes?.length ?? 0 }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("[relink-outline-sources] error", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : String(e) }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
