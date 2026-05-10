import {
  File,
  FileText,
  FileSpreadsheet,
  FileImage,
  FileType,
  Presentation,
  type LucideIcon,
} from "lucide-react";
import type { Database } from "@/integrations/supabase/types";

export type DocumentType = Database["public"]["Enums"]["document_type"];

export const ALLOWED_EXTENSIONS = [
  ".pdf",
  ".doc",
  ".docx",
  ".xls",
  ".xlsx",
  ".ppt",
  ".pptx",
  ".txt",
  ".csv",
] as const;

export const ALLOWED_MIME_TYPES: Record<string, string[]> = {
  "application/pdf": [".pdf"],
  "application/msword": [".doc"],
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": [".docx"],
  "application/vnd.ms-excel": [".xls"],
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": [".xlsx"],
  "application/vnd.ms-powerpoint": [".ppt"],
  "application/vnd.openxmlformats-officedocument.presentationml.presentation": [".pptx"],
  "text/plain": [".txt"],
  "text/csv": [".csv"],
};

export const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB

export function getFileIcon(mimeOrName: string): LucideIcon {
  const v = mimeOrName.toLowerCase();
  if (v.includes("pdf")) return FileType;
  if (v.includes("sheet") || v.includes("excel") || v.endsWith(".xls") || v.endsWith(".xlsx") || v.endsWith(".csv") || v.includes("csv"))
    return FileSpreadsheet;
  if (v.includes("presentation") || v.includes("powerpoint") || v.endsWith(".ppt") || v.endsWith(".pptx"))
    return Presentation;
  if (v.includes("word") || v.includes("document") || v.endsWith(".doc") || v.endsWith(".docx"))
    return FileText;
  if (v.startsWith("image/")) return FileImage;
  return File;
}

export function formatFileSize(bytes: number | null | undefined): string {
  if (!bytes && bytes !== 0) return "—";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
  return `${(bytes / 1024 / 1024 / 1024).toFixed(2)} GB`;
}

export function getDocumentTypeFromFilename(filename: string): DocumentType {
  const f = filename.toLowerCase();
  if (f.includes("amendment") || f.includes("amend")) return "amendment";
  if (f.includes("sow") || f.includes("statement of work") || f.includes("statement-of-work")) return "sow";
  if (f.includes("q&a") || f.includes("q-and-a") || f.includes("qa_log") || f.includes("questions") || f.includes("q_a"))
    return "qa_log";
  if (f.includes("pricing") || f.includes("cost") || f.includes("price")) return "pricing_sheet";
  if (f.includes("evaluation") || f.includes("criteria")) return "evaluation_criteria";
  if (f.includes("terms") || f.includes("t&c") || f.includes("conditions")) return "terms_conditions";
  if (f.includes("incumbent")) return "incumbent_contract";
  if (f.includes("rfp")) return "rfp";
  if (f.includes("rfq")) return "rfq";
  if (f.includes("rfi")) return "rfi";
  if (f.includes("pre-solicitation") || f.includes("presolicitation")) return "pre_solicitation";
  if (f.includes("prior")) return "prior_solicitation";
  if (f.includes("attachment") || f.includes("exhibit") || f.includes("appendix")) return "attachment";
  return "other";
}

export const DOCUMENT_TYPE_LABELS: Record<DocumentType, string> = {
  rfp: "RFP",
  rfq: "RFQ",
  rfi: "RFI",
  pre_solicitation: "Pre-Solicitation",
  sow: "Statement of Work",
  terms_conditions: "Terms & Conditions",
  amendment: "Amendment",
  qa_log: "Q&A Log",
  evaluation_criteria: "Evaluation Criteria",
  pricing_sheet: "Pricing Sheet",
  incumbent_contract: "Incumbent Contract",
  prior_solicitation: "Prior Solicitation",
  attachment: "Attachment",
  other: "Other",
};

export const DOCUMENT_TYPES: DocumentType[] = [
  "rfp",
  "rfq",
  "rfi",
  "pre_solicitation",
  "sow",
  "terms_conditions",
  "amendment",
  "qa_log",
  "evaluation_criteria",
  "pricing_sheet",
  "incumbent_contract",
  "prior_solicitation",
  "attachment",
  "other",
];

export function validateFile(file: File): { valid: boolean; error?: string } {
  if (file.size > MAX_FILE_SIZE) {
    return { valid: false, error: `File exceeds 50MB limit (${formatFileSize(file.size)})` };
  }
  const ext = "." + (file.name.split(".").pop() ?? "").toLowerCase();
  if (!ALLOWED_EXTENSIONS.includes(ext as (typeof ALLOWED_EXTENSIONS)[number])) {
    return {
      valid: false,
      error: `Unsupported file type "${ext}". Allowed: ${ALLOWED_EXTENSIONS.join(", ")}`,
    };
  }
  return { valid: true };
}

export function sanitizeFilename(name: string): string {
  return name.replace(/[^a-zA-Z0-9._-]/g, "_");
}
