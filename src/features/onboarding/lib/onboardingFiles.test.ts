import { describe, it, expect } from "vitest";
import {
  validateOnboardingFile, onboardingPath, clientStatusLabel, clientCanDelete, matchesFilter,
} from "./onboardingFiles";

describe("onboarding files", () => {
  it("allows the listed types up to 25 MB", () => {
    expect(validateOnboardingFile("a.md", 10)).toBeNull();
    expect(validateOnboardingFile("a.pptx", 10)).not.toBeNull();
    expect(validateOnboardingFile("a.pdf", 25 * 1024 * 1024 + 1)).not.toBeNull();
  });
  it("stores under client folder with document id", () => {
    expect(onboardingPath("c1", "d1", "My Cap Stmt.pdf")).toBe("c1/d1-My_Cap_Stmt.pdf");
  });
  it("shows triaged as Received and blocks delete", () => {
    expect(clientStatusLabel("triaged")).toBe("Received");
    expect(clientCanDelete("triaged")).toBe(false);
    expect(clientCanDelete("failed")).toBe(true);
  });
  it("uses final destinations once reviewed", () => {
    const t = { destinations: ["restricted"], final_destinations: ["profile"], requires_cleaning: false, reviewed_at: "x" };
    expect(matchesFilter("restricted", t)).toBe(false);
    expect(matchesFilter("needs_review", t)).toBe(false);
  });
});
