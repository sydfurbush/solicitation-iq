import { describe, it, expect, vi } from "vitest";
vi.mock("@/integrations/supabase/client", () => ({ supabase: {} }));
vi.mock("@/features/auth/hooks/useUser", () => ({ useUser: () => ({ role: null }) }));
import { canEditRequirementLinks } from "./useRequirementLinks";

describe("canEditRequirementLinks", () => {
  it("allows owner, admin and analyst", () => {
    expect(canEditRequirementLinks("owner")).toBe(true);
    expect(canEditRequirementLinks("admin")).toBe(true);
    expect(canEditRequirementLinks("analyst")).toBe(true);
  });
  it("blocks viewers and users without a role", () => {
    expect(canEditRequirementLinks("viewer")).toBe(false);
    expect(canEditRequirementLinks(null)).toBe(false);
  });
});
