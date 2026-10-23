// Extracts plain text from a file in Supabase Storage (PDF, Word, Excel, text).
// Shared by ingest-client-knowledge and triage-onboarding-document.
import { Buffer } from "node:buffer";
import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import pdfParse from "npm:pdf-parse@1.1.1";
import mammoth from "npm:mammoth@1.6.0";
import * as XLSX from "npm:xlsx@0.18.5";

export class UnsupportedFileError extends Error {}

export async function extractStorageText(
  sb: SupabaseClient,
  bucket: string,
  filePath: string,
  mimeType: string | null,
): Promise<string> {
  const { data, error } = await sb.storage.from(bucket).download(filePath);
  if (error || !data) throw new Error(`download failed: ${error?.message ?? "no data"}`);
  const lowerPath = filePath.toLowerCase();
  const lowerMime = (mimeType ?? "").toLowerCase();
  const bytes = new Uint8Array(await data.arrayBuffer());

  if (lowerMime === "application/pdf" || lowerPath.endsWith(".pdf")) {
    const result = await pdfParse(Buffer.from(bytes));
    return result.text ?? "";
  }
  if (
    lowerPath.endsWith(".docx") ||
    lowerPath.endsWith(".doc") ||
    lowerMime === "application/vnd.openxmlformats-officedocument.wordprocessingml.document" ||
    lowerMime === "application/msword"
  ) {
    const { value } = await mammoth.extractRawText({ buffer: Buffer.from(bytes) });
    return value ?? "";
  }
  if (lowerPath.endsWith(".xlsx") || lowerPath.endsWith(".xls") || lowerMime.includes("sheet") || lowerMime.includes("excel")) {
    const wb = XLSX.read(bytes, { type: "array" });
    const parts: string[] = [];
    for (const name of wb.SheetNames) {
      parts.push(`=== ${name} ===`);
      parts.push(XLSX.utils.sheet_to_csv(wb.Sheets[name]));
    }
    return parts.join("\n");
  }
  if (lowerMime.startsWith("text/") || lowerPath.endsWith(".txt") || lowerPath.endsWith(".md") || lowerPath.endsWith(".csv")) {
    return new TextDecoder().decode(bytes);
  }
  throw new UnsupportedFileError(`Unsupported file type "${mimeType ?? "unknown"}". Upload PDF, Word, Excel, .txt, .md or .csv.`);
}
