import { describe, it, expect } from "vitest";
import {
  normalizeReqNumber,
  buildReqIndex,
  resolveRequirementRefs,
  findUnplacedRequirements,
  buildRequirementPromptList,
  extractCitedReqNumbers,
  isRequirementCited,
  findUncitedRequirements,
  stripCitationTags,
} from "./requirementLinks";

const reqs = [
  { id: "a", req_number: "C-1.1" },
  { id: "b", req_number: "C-1.5.5.1" },
  { id: "c", req_number: "C-1.6.7.10.2" },
  { id: "d", req_number: "L-4" },
];

describe("normalizeReqNumber", () => {
  it("treats separators, case and brackets as equivalent", () => {
    const forms = ["C-1.1", "c.1.1", "C_1_1", "[Req-C-1.1]", "Req C-1.1", "C\u20131.1", " c-1.1 ", "\\[Req-C-1.1\\]"];
    for (const f of forms) expect(normalizeReqNumber(f)).toBe("c.1.1");
  });

  it("keeps different requirements different", () => {
    expect(normalizeReqNumber("C-1.1")).not.toBe(normalizeReqNumber("C-1.1.1"));
    expect(normalizeReqNumber("C-1.1")).not.toBe(normalizeReqNumber("C-11"));
  });

  it("handles numbering schemes that already start with REQ", () => {
    expect(normalizeReqNumber("REQ-001")).toBe(normalizeReqNumber("[Req-REQ-001]"));
  });

  it("returns empty string for missing values", () => {
    expect(normalizeReqNumber(null)).toBe("");
    expect(normalizeReqNumber(undefined)).toBe("");
  });
});

describe("resolveRequirementRefs", () => {
  const index = buildReqIndex(reqs);

  it("matches exact refs", () => {
    expect(resolveRequirementRefs("C-1.1, C-1.5.5.1", index)).toEqual({ ids: ["a", "b"], unmatched: [] });
  });

  it("matches refs written with a different separator (the cause of silent gaps)", () => {
    expect(resolveRequirementRefs("C.1.1; c.1.6.7.10.2", index).ids).toEqual(["a", "c"]);
  });

  it("deduplicates and reports refs it cannot match", () => {
    const r = resolveRequirementRefs("C-1.1 C.1.1 Z-9", index);
    expect(r.ids).toEqual(["a"]);
    expect(r.unmatched).toEqual(["Z-9"]);
  });

  it("handles empty input", () => {
    expect(resolveRequirementRefs("", index)).toEqual({ ids: [], unmatched: [] });
    expect(resolveRequirementRefs(null, index)).toEqual({ ids: [], unmatched: [] });
  });
});

describe("findUnplacedRequirements", () => {
  it("returns requirements not linked to any node", () => {
    const unplaced = findUnplacedRequirements(reqs, [["a"], ["c"], null, []]);
    expect(unplaced.map((r) => r.req_number)).toEqual(["C-1.5.5.1", "L-4"]);
  });

  it("returns nothing when everything is placed", () => {
    expect(findUnplacedRequirements(reqs, [["a", "b"], ["c", "d"]])).toEqual([]);
  });
});

describe("buildRequirementPromptList", () => {
  const make = (n: number) =>
    Array.from({ length: n }, (_, i) => ({
      req_number: `C-${i + 1}`,
      source_section: `C.${i + 1}`,
      shall_text: "The contractor shall ".repeat(30),
    }));

  it("includes every requirement, even past 200", () => {
    const text = buildRequirementPromptList(make(450));
    expect(text.split("\n")).toHaveLength(450);
    expect(text).toContain("C-450 [C.450]");
  });

  it("shortens text to stay near the budget", () => {
    const text = buildRequirementPromptList(make(450), 60_000);
    expect(text.length).toBeLessThan(75_000);
  });

  it("keeps up to 240 characters when the list is short", () => {
    const line = buildRequirementPromptList(make(1)).split("\n")[0];
    expect(line.length).toBeLessThanOrEqual("C-1 [C.1] ".length + 240);
    expect(line.endsWith("…")).toBe(true);
  });

  it("returns empty string for no requirements", () => {
    expect(buildRequirementPromptList([])).toBe("");
  });
});

describe("citation detection", () => {
  it("finds plain, escaped and differently-cased tags", () => {
    const text = "We comply [Req-C-1.1]. Staff are trained \\[Req-C-1.5.5.1\\] and [REQ C.1.6.7.10.2].";
    expect([...extractCitedReqNumbers(text)].sort()).toEqual(["c.1.1", "c.1.5.5.1", "c.1.6.7.10.2"]);
  });

  it("does not treat a longer number as citing a shorter one", () => {
    expect(isRequirementCited("[Req-C-1.1.1]", "C-1.1")).toBe(false);
    expect(isRequirementCited("[Req-C-1.1.1]", "C-1.1.1")).toBe(true);
  });

  it("ignores knowledge tags and ordinary brackets", () => {
    expect(extractCitedReqNumbers("See [K1] and [Figure 2] and [link](https://x.y)").size).toBe(0);
  });

  it("lists linked requirements the text does not cite", () => {
    expect(findUncitedRequirements("Covered [Req-C-1.1].", ["C-1.1", "C-1.5.5.1", null])).toEqual(["C-1.5.5.1"]);
  });

  it("handles empty text", () => {
    expect(isRequirementCited(null, "C-1.1")).toBe(false);
    expect(isRequirementCited("[Req-C-1.1]", null)).toBe(false);
  });
});

describe("stripCitationTags", () => {
  it("removes requirement and knowledge tags and tidies spacing", () => {
    const input = "We meet the standard [Req-C-1.1] using our process [K2]. Staff hold CACs \\[Req-C-1.6.7.10.2\\], always.";
    expect(stripCitationTags(input)).toBe("We meet the standard using our process. Staff hold CACs, always.");
  });

  it("removes tags wrapped in parentheses", () => {
    expect(stripCitationTags("Trained staff ([Req-C-1.5.5.1]) are ready.")).toBe("Trained staff are ready.");
  });

  it("leaves markdown links, bold text and other brackets alone", () => {
    const input = "**Bold** text with a [link](https://example.com) and [Figure 2].";
    expect(stripCitationTags(input)).toBe(input);
  });

  it("keeps line structure", () => {
    expect(stripCitationTags("- Item one [Req-C-1.1]\n- Item two")).toBe("- Item one\n- Item two");
  });
});
