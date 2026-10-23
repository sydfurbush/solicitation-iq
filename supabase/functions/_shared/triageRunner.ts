// Runs the onboarding triage for one document row. Shared by
// triage-onboarding-document and recheck-knowledge-document so both apply
// exactly the same steps. Call only AFTER the caller's access is verified.
import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { callAiTool } from "./aiClient.ts";
import { extractStorageText, UnsupportedFileError } from "./extractText.ts";
import {
  TRIAGE_SYSTEM_PROMPT,
  TRIAGE_TOOL,
  buildTriageUserPrompt,
  normalizeClassification,
  sampleDocumentText,
  triageDocument,
} from "./onboardingTriage.ts";

export const ONBOARDING_BUCKET = "client-onboarding";

export interface OnboardingDocRow {
  id: string;
  client_id: string;
  file_name: string;
  file_path: string;
  mime_type: string | null;
}

export async function markStatus(admin: SupabaseClient, documentId: string, status: string, error: string | null = null) {
  await admin.from("client_onboarding_documents")
    .update({ status, error, updated_at: new Date().toISOString() })
    .eq("id", documentId);
}

export async function runOnboardingTriage(admin: SupabaseClient, doc: OnboardingDocRow): Promise<void> {
  await markStatus(admin, doc.id, "processing");

  const { data: client } = await admin.from("clients").select("name").eq("id", doc.client_id).maybeSingle();

  const text = await extractStorageText(admin, ONBOARDING_BUCKET, doc.file_path, doc.mime_type);
  if (text.replace(/\s+/g, "").length < 40) {
    throw new UnsupportedFileError("No readable text found. If this is a scanned image, please upload a text-based PDF or Word file.");
  }

  const raw = await callAiTool({
    functionName: "triage-onboarding-document",
    system: TRIAGE_SYSTEM_PROMPT,
    user: buildTriageUserPrompt(doc.file_name, sampleDocumentText(text), client?.name ?? ""),
    tool: TRIAGE_TOOL,
  });
  const result = triageDocument(normalizeClassification(raw), text);

  const { error: saveErr } = await admin.from("client_onboarding_triage").upsert({
    document_id: doc.id,
    client_id: doc.client_id,
    doc_type: result.doc_type,
    relevance: result.relevance,
    title: result.title,
    summary: result.summary,
    document_date: result.document_date,
    solicitation_numbers: result.solicitation_numbers,
    useful_for: result.useful_for,
    sensitivity: { ...result.sensitivity, detected: result.detected },
    destinations: result.destinations,
    requires_cleaning: result.requires_cleaning,
    reasons: result.reasons,
    notes: result.notes,
    subject: result.subject,
    subject_name: result.subject_name,
    partner_names: result.partner_names,
    client_role: result.client_role,
    text_chars: text.length,
    updated_at: new Date().toISOString(),
  }, { onConflict: "document_id" });
  if (saveErr) throw saveErr;

  await markStatus(admin, doc.id, "triaged");
}
