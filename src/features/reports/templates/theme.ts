// Branded report theme — matches the Army TAP sample.
// Used by both PDF (jsPDF) and Word (docx) generators.

export const REPORT_THEME = {
  // Core brand
  navy: "#1E3A5F",
  navyDark: "#15314F",
  amber: "#C9A227",
  amberLight: "#E8C766",
  // Tones
  oppGreen: "#2E7D32",
  oppTint: "#E8F3EA",
  riskRed: "#C62828",
  riskTint: "#FBEAEA",
  cream: "#FFF8E1",
  lightBlue: "#EAF2FA",
  // Neutrals
  text: "#374151",
  textMuted: "#6B7280",
  textOnNavy: "#FFFFFF",
  border: "#E5E7EB",
  rowAlt: "#F5F7FA",
  white: "#FFFFFF",
} as const;

// jsPDF wants RGB tuples
export const RGB = {
  navy: [30, 58, 95] as [number, number, number],
  amber: [201, 162, 39] as [number, number, number],
  oppGreen: [46, 125, 50] as [number, number, number],
  oppTint: [232, 243, 234] as [number, number, number],
  riskRed: [198, 40, 40] as [number, number, number],
  riskTint: [251, 234, 234] as [number, number, number],
  cream: [255, 248, 225] as [number, number, number],
  lightBlue: [234, 242, 250] as [number, number, number],
  text: [55, 65, 81] as [number, number, number],
  textMuted: [107, 114, 128] as [number, number, number],
  white: [255, 255, 255] as [number, number, number],
  border: [229, 231, 235] as [number, number, number],
  rowAlt: [245, 247, 250] as [number, number, number],
  bandGrey: [228, 230, 234] as [number, number, number],
  tileGrey: [237, 240, 244] as [number, number, number],
};

export type CategoryTone =
  | "contradiction"
  | "risk_concern"
  | "quantitative_gap"
  | "compliance"
  | "drafting_error"
  | "clarification"
  | "scope_expansion"
  | "strategic"
  | "internal"
  | "neutral";

export const CATEGORY_RGB: Record<CategoryTone, { solid: [number, number, number]; tint: [number, number, number]; label: string }> = {
  contradiction:    { solid: [30, 58, 95],    tint: [234, 242, 250], label: "CONTRADICTION" },
  risk_concern:     { solid: [229, 115, 115], tint: [251, 234, 234], label: "RISK CONCERN" },
  quantitative_gap: { solid: [46, 125, 50],   tint: [232, 243, 234], label: "QUANTITATIVE GAP" },
  compliance:       { solid: [38, 166, 154],  tint: [224, 242, 241], label: "COMPLIANCE" },
  drafting_error:   { solid: [149, 117, 205], tint: [237, 231, 246], label: "DRAFTING ERROR" },
  clarification:    { solid: [66, 165, 245],  tint: [227, 242, 253], label: "CLARIFICATION" },
  scope_expansion:  { solid: [244, 169, 91],  tint: [255, 243, 224], label: "SCOPE EXPANSION" },
  strategic:        { solid: [236, 64, 122],  tint: [252, 228, 236], label: "STRATEGIC" },
  internal:         { solid: [120, 144, 156], tint: [236, 239, 241], label: "INTERNAL" },
  neutral:          { solid: [107, 114, 128], tint: [243, 244, 246], label: "QUESTION" },
};

export const CATEGORY_HEX: Record<CategoryTone, { solid: string; tint: string; label: string }> = {
  contradiction:    { solid: "1E3A5F", tint: "EAF2FA", label: "CONTRADICTION" },
  risk_concern:     { solid: "E57373", tint: "FBEAEA", label: "RISK CONCERN" },
  quantitative_gap: { solid: "2E7D32", tint: "E8F3EA", label: "QUANTITATIVE GAP" },
  compliance:       { solid: "26A69A", tint: "E0F2F1", label: "COMPLIANCE" },
  drafting_error:   { solid: "9575CD", tint: "EDE7F6", label: "DRAFTING ERROR" },
  clarification:    { solid: "42A5F5", tint: "E3F2FD", label: "CLARIFICATION" },
  scope_expansion:  { solid: "F4A95B", tint: "FFF3E0", label: "SCOPE EXPANSION" },
  strategic:        { solid: "EC407A", tint: "FCE4EC", label: "STRATEGIC" },
  internal:         { solid: "78909C", tint: "ECEFF1", label: "INTERNAL" },
  neutral:          { solid: "6B7280", tint: "F3F4F6", label: "QUESTION" },
};

export function normalizeCategoryTone(category: string | null | undefined): CategoryTone {
  const k = (category ?? "").toLowerCase().replace(/[^a-z]+/g, "_").replace(/^_|_$/g, "");
  if (k.includes("contradict")) return "contradiction";
  if (k.includes("risk")) return "risk_concern";
  if (k.includes("quant") || k.includes("gap")) return "quantitative_gap";
  if (k.includes("compli")) return "compliance";
  if (k.includes("draft") || k.includes("error")) return "drafting_error";
  if (k.includes("clarif")) return "clarification";
  if (k.includes("scope")) return "scope_expansion";
  if (k.includes("strateg") || k.includes("hold")) return "strategic";
  if (k.includes("internal") || k.includes("monitor")) return "internal";
  return "neutral";
}

// docx wants hex without `#`
export const HEX = {
  navy: "1E3A5F",
  amber: "C9A227",
  oppGreen: "2E7D32",
  oppTint: "E8F3EA",
  riskRed: "C62828",
  riskTint: "FBEAEA",
  cream: "FFF8E1",
  lightBlue: "EAF2FA",
  text: "374151",
  textMuted: "6B7280",
  white: "FFFFFF",
  border: "E5E7EB",
  rowAlt: "F5F7FA",
};

export const FONT_PDF = "helvetica";
export const FONT_DOCX = "Arial";

export const DEFAULT_FOOTER_TEXT = "CONFIDENTIAL — FOR CLIENT USE ONLY";
