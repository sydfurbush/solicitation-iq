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
};

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
