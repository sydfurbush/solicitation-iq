import { describe, it, expect } from "vitest";
import { parseBearerToken } from "./authHeader";

describe("parseBearerToken", () => {
  it("extracts a JWT", () => {
    expect(parseBearerToken("Bearer aaa.bbb.ccc")).toBe("aaa.bbb.ccc");
    expect(parseBearerToken("  bearer aaa-1.b_b.c  ")).toBe("aaa-1.b_b.c");
  });
  it("rejects missing or malformed headers", () => {
    expect(parseBearerToken(null)).toBeNull();
    expect(parseBearerToken("")).toBeNull();
    expect(parseBearerToken("Basic abc")).toBeNull();
    expect(parseBearerToken("Bearer notajwt")).toBeNull();
    expect(parseBearerToken("Bearer a.b.c extra")).toBeNull();
  });
});
