import { describe, it, expect } from "vitest";
import { receivedLabel, safePortalRedirect, senderDisplayName } from "./onboardingFiles";

describe("receivedLabel", () => {
  it("formats emailed files with uploader", () => {
    expect(receivedLabel({ received_via: "email", received_from: "Tori Ingram <tori.ingram@persessi.com>", received_on: "2026-10-23", uploaderName: "Sydney Furbush" }))
      .toBe("Email · Tori Ingram · Oct 23, 2026 (uploaded by Sydney)");
  });
  it("formats portal uploads using the uploader as sender", () => {
    expect(receivedLabel({ received_via: "portal", created_at: "2026-10-23T15:00:00Z", uploaderName: "Tori Ingram" }))
      .toBe("Portal · Tori Ingram · Oct 23, 2026");
  });
  it("formats other without sender", () => {
    expect(receivedLabel({ received_via: "other", received_on: "2026-01-05", uploaderName: "Sam" })).toBe("Other · Jan 5, 2026 (uploaded by Sam)");
  });
  it("keeps bare emails", () => expect(senderDisplayName("a@b.com")).toBe("a@b.com"));
});

describe("safePortalRedirect", () => {
  it("allows portal paths", () => expect(safePortalRedirect("/portal/documents")).toBe("/portal/documents"));
  it.each(["https://evil.com/portal/x", "//evil.com", "/dashboard", "/portal/../admin", "/portalx", "javascript:alert(1)"])(
    "rejects %s", (v) => expect(safePortalRedirect(v)).toBe("/portal"));
  it("falls back when empty", () => expect(safePortalRedirect(null)).toBe("/portal"));
});
