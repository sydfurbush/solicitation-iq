/** Persisted in `organizations.settings.brand` */
export interface BrandTemplate {
  /** Display name shown on cover (defaults to org.name) */
  firmName?: string;
  /** Public URL of the firm logo (PNG/JPG) */
  logoUrl?: string;
  /** Hex string e.g. "#1F3A8A" — used for cover accent bar, table headers, footer rule */
  primaryColor?: string;
  /** Optional accent hex for table header text */
  accentColor?: string;
  /** Header text shown on every body page (e.g. "CONFIDENTIAL · ACME PROPOSALS") */
  headerText?: string;
  /** Footer text shown on every body page (left side) */
  footerText?: string;
  /** Whether to show "Page X of Y" on the right side of the footer */
  showPageNumbers?: boolean;
  /** Whether to show the logo on the cover page */
  showLogoOnCover?: boolean;
}

export const DEFAULT_BRAND: BrandTemplate = {
  primaryColor: "#283C5A",
  accentColor: "#FFFFFF",
  showPageNumbers: true,
  showLogoOnCover: true,
};
