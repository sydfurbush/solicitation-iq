import { describe, it, expect } from "vitest";
import { isInternalVolume } from "./outlineVolumes";

describe("isInternalVolume", () => {
  it("recognizes internal tracking volumes", () => {
    expect(isInternalVolume("Internal – Submission Checklist (not submitted)")).toBe(true);
    expect(isInternalVolume("  internal notes")).toBe(true);
  });
  it("keeps every submitted volume", () => {
    for (const v of ["Volume I – General", "Volume II – Technical", "Volume III – Past Performance", "Volume IV – Price", "International Programs", "", null]) {
      expect(isInternalVolume(v)).toBe(false);
    }
  });
});
