// Extract structured capabilities from a capability statement document or pasted text.
// Returns a draft Capabilities object that the UI shows to the user for field-by-field review
// before merging into clients.metadata.capabilities. Never writes to the DB directly.

import { Buffer } from "node:buffer";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { z } from "npm:zod@3.23.8";
import pdfParse from "npm:pdf-parse@1.1.1";
import mammoth from "npm:mammoth@1.6.0";
import { callAiTool, aiErrorResponse, AiHttpError } from "../_shared/aiClient.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;

const MAX_TEXT_CHARS = 60_000;
const MAX_FILE_BYTES = 15 * 1024 * 1024;

const Body = z.object({
  clientId: z.string().uuid(),
  // Provide ONE of these.
  text: z.string().max(200_000).optional(),
  fileBase64: z.string().max(25_000_000).optional(),
  fileName: z.string().max(255).optional(),
  mimeType: z.string().max(255).optional(),
});

const SCHEMA = {
  name: "extract_client_capabilities",
  description: "Extract structured capabilities information from a client's capability statement.",
  parameters: {
    type: "object",
    properties: {
      capabilities: {
        type: "object",
        properties: {
          core_capabilities: {
            type: "string",
            description: "Markdown summary (3-8 bullets) of the client's primary service offerings.",
          },
          differentiators: { type: "string", description: "What sets this client apart from competitors. Markdown bullets ok." },
          past_performance: {
            type: "string",
            description: "Notable past contracts/customers. Include agency/customer, scope, value, and outcomes if available. Markdown bullets.",
          },
          key_personnel: { type: "string", description: "Named leaders with roles/clearances, or role titles if no names listed." },
          teaming_partners: { type: "string", description: "Named primes/subs/OEMs/strategic partners." },
          notes: { type: "string", description: "Anything important that doesn't fit the other fields (locations, ISO/CMMI, points of contact)." },
          naics_codes: {
            type: "array",
            items: { type: "string", pattern: "^\\d{6}$" },
            description: "6-digit NAICS codes explicitly listed in the document.",
          },
          certifications: {
            type: "array",
            items: { type: "string" },
            description: "Certifications and set-asides as written (e.g. '8(a)', 'WOSB', 'CMMC L2', 'ISO 27001').",
          },
        },
        required: [],
      },
      profile_hints: {
        type: "object",
        description: "Extra structured signal that could feed client_profiles later.",
        properties: {
          psc_codes: { type: "array", items: { type: "string" } },
          agencies_focus: { type: "array", items: { type: "string" }, description: "Federal agencies or utility buyers explicitly served." },
          contract_vehicles: { type: "array", items: { type: "string" }, description: "Named vehicles (GSA MAS, SEWP V, OASIS, CIO-SP3, etc.)." },
          compliance_frameworks: { type: "array", items: { type: "string" } },
          service_categories: { type: "array", items: { type: "string" } },
        },
      },
      source_excerpts: {
        type: "object",
        description: "Verbatim short excerpts (<=300 chars) from the source document that justify each field. Keys match capability field names.",
        additionalProperties: { type: "string" },
      },
      confidence: {
        type: "object",
        description: "0-1 confidence per field. Keys match capability field names.",
        additionalProperties: { type: "number" },
      },
    },
    required: ["capabilities"],
  },
} as const;

const SYSTEM_PROMPT = `You extract structured capabilities from a vendor capability statement.

Rules:
- Use ONLY information present in the document. Do not invent NAICS codes, agencies, vehicles, or certifications.
- If a field is not present, omit it (do not return empty strings or null placeholders).
- NAICS codes must be exactly 6 digits. Discard malformed codes.
- Normalize certifications to common forms: "8(a)", "WOSB", "EDWOSB", "HUBZone", "SDVOSB", "VOSB", "SDB", "ISO 9001", "ISO 27001", "CMMI Level 3", "CMMC L2", etc. — but only if explicitly claimed.
- For past_performance, prefer concise bullet points with customer / scope / value / outcome.
- Return source_excerpts (verbatim, <=300 chars) for every non-empty field you produce, keyed by field name.
- Return confidence (0-1) for every non-empty field you produce, keyed by field name.

Return ONLY the structured tool call.`;

async function extractText(input: {
  text?: string;
  fileBase64?: string;
  fileName?: string;
  mimeType?: string;
}): Promise<string> {
  if (input.text && input.text.trim()) return input.text;
  if (!input.fileBase64) throw new Error("Provide either 'text' or 'fileBase64'.");

  const buf = Buffer.from(input.fileBase64, "base64");
  if (buf.byteLength > MAX_FILE_BYTES) {
    throw new Error(`File too large (${(buf.byteLength / 1_048_576).toFixed(1)} MB). Max 15 MB.`);
  }
  const name = (input.fileName ?? "").toLowerCase();
  const mime = (input.mimeType ?? "").toLowerCase();

  if (mime === "application/pdf" || name.endsWith(".pdf")) {
    const r = await pdfParse(buf);
    return r.text ?? "";
  }
  if (
    name.endsWith(".docx") ||
    name.endsWith(".doc") ||
    mime === "application/vnd.openxmlformats-officedocument.wordprocessingml.document" ||
    mime === "application/msword"
  ) {
    const { value } = await mammoth.extractRawText({ buffer: buf });
    return value ?? "";
  }
  if (mime.startsWith("text/") || name.endsWith(".txt") || name.endsWith(".md")) {
    return new TextDecoder().decode(buf);
  }
  throw new Error(`Unsupported file type "${input.mimeType ?? input.fileName ?? "unknown"}". Upload PDF, Word, .txt, or .md, or paste text directly.`);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    // AuthN: require a signed-in user.
    const authHeader = req.headers.get("Authorization") ?? "";
    const userClient = createClient(SUPABASE_URL, ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: userData, error: userErr } = await userClient.auth.getUser();
    if (userErr || !userData?.user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const parsed = Body.safeParse(await req.json());
    if (!parsed.success) {
      return new Response(JSON.stringify({ error: parsed.error.flatten().fieldErrors }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const { clientId, text, fileBase64, fileName, mimeType } = parsed.data;

    // AuthZ: caller must share the same organization as the target client.
    const admin = createClient(SUPABASE_URL, SERVICE_KEY);
    const [{ data: client }, { data: caller }] = await Promise.all([
      admin.from("clients").select("id, organization_id, name").eq("id", clientId).maybeSingle(),
      admin.from("users").select("id, organization_id").eq("id", userData.user.id).maybeSingle(),
    ]);
    if (!client) {
      return new Response(JSON.stringify({ error: "Client not found" }), {
        status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (!caller || caller.organization_id !== client.organization_id) {
      return new Response(JSON.stringify({ error: "Forbidden" }), {
        status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Extract raw text from the upload OR use pasted text.
    let raw = "";
    try {
      raw = await extractText({ text, fileBase64, fileName, mimeType });
    } catch (e) {
      return new Response(JSON.stringify({ error: e instanceof Error ? e.message : String(e) }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    raw = (raw ?? "").replace(/\u0000/g, "").trim();
    if (raw.length < 40) {
      return new Response(JSON.stringify({ error: "Could not read enough text from the document. Try pasting the content directly." }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const truncated = raw.length > MAX_TEXT_CHARS;
    const body = truncated ? raw.slice(0, MAX_TEXT_CHARS) : raw;

    const userPrompt = `Client name: ${client.name ?? "(unknown)"}

Source document text${truncated ? ` (first ${MAX_TEXT_CHARS.toLocaleString()} characters of ${raw.length.toLocaleString()})` : ""}:
"""
${body}
"""

Return the structured extraction via the tool call.`;

    const result = await callAiTool({
      functionName: "extract-capabilities",
      system: SYSTEM_PROMPT,
      user: userPrompt,
      tool: SCHEMA,
    });

    return new Response(JSON.stringify({
      success: true,
      draft: result,
      meta: {
        sourceChars: raw.length,
        truncated,
        sourceKind: text ? "pasted" : "upload",
      },
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("[extract-capabilities] error", e);
    if (e instanceof AiHttpError) return aiErrorResponse(e, corsHeaders);
    return aiErrorResponse(e, corsHeaders);
  }
});
