import { describe, it, expect } from "vitest";
import {
  docKindFromFileName,
  textSimilarity,
  sharedWords,
  parseReference,
  itemKeys,
  refCovers,
  classifyApplicability,
  findHeaderRow,
  parseMatrixSheet,
  normalizeWorkflowStatus,
  normalizeCriticality,
  planImport,
  mergeExtracted,
  isRequirementSection,
  batchSections,
  type ExistingItem,
  type ImportRow,
} from "./complianceMatrix";

const item = (id: string, source_section: string, doc_kind: ExistingItem["doc_kind"], shall_text: string, extra: Partial<ExistingItem> = {}): ExistingItem => ({
  id, req_number: null, shall_text, source_section, doc_kind, origin: "ai", external_id: null, covered_by_id: null, ...extra,
});

const HEADER = ["ID", "Area", "Requirement Type", "Reference", "Requirement / Instruction", "Proposal Location", "Required Response / Evidence", "Status", "Information Needed / Action", "Gov Clarification?", "Criticality", "Owner", "Final Verified", "Source Document"];
const sheet = (...rows: unknown[][]) => [["Master Compliance Matrix"], ["Filter by Area"], [], HEADER, ...rows];
const row = (id: string, area: string, ref: string, text: string, status = "Drafted", clar = "No", crit = "High") =>
  [id, area, "Technical", ref, text, "Volume II", "Evidence", status, "Action", clar, crit, "Proposal Team", null, "PWS.pdf"];

describe("docKindFromFileName", () => {
  it("recognizes PWS, wage determinations and solicitations", () => {
    expect(docKindFromFileName("IA02_PERFORMANCE WORK STATEMENT_ESSC_14 SEP 26_Final (002).pdf")).toBe("pws");
    expect(docKindFromFileName("WAGEDETERMINATION_2015-4681.pdf")).toBe("wage_determination");
    expect(docKindFromFileName("IB08_Solicitation - W9124D27RA006_RELEASED.pdf")).toBe("solicitation");
  });
});

describe("textSimilarity", () => {
  it("scores shared meaningful words", () => {
    expect(textSimilarity("Subject line for each transmission must include solicitation number", "Subject line for each transmission shall include solicitation number W9124D-27-R-A006.")).toBe(1);
  });
  it("ignores numbers, dates and times so two deadlines don't match", () => {
    expect(textSimilarity("Proposal due 9:00 a.m. EST, 20 November 2026.", "Written questions shall be submitted NO LATER THAN 9:00 a.m., EST, 3 November 2026.")).toBe(0);
  });
  it("counts shared words", () => {
    expect(sharedWords("Submit resumes and letters of intent", "Provide resumes and letters of intent")).toBe(3);
  });
  it("needs at least two shared words", () => {
    expect(textSimilarity("Proposal due", "The proposal shall be presented in Adobe pdf.")).toBe(0);
  });
});

describe("references", () => {
  it("parses PWS sections, ranges, lists, exhibits and clauses", () => {
    expect(parseReference("PWS 5.1.4.4-5.1.4.5")).toEqual([{ kind: "pws", value: "5.1.4.4", end: "5.1.4.5" }]);
    expect(parseReference("PWS 1.4.3; 5.1.5; 5.3.1.3").filter((k) => k.kind === "pws").map((k) => k.value)).toEqual(["1.4.3", "5.1.5", "5.3.1.3"]);
    expect(parseReference("TE2: PWS 5.5.1.3-5.5.1.4").map((k) => k.kind)).toEqual(["pws", "te"]);
    expect(parseReference("PWS 1.6.7.1.2; DFARS 252.204-7012")).toContainEqual({ kind: "clause", value: "252.204-7012" });
  });
  it("treats instruction and container-clause references as broad", () => {
    expect(parseReference("Addendum 52.212-1 A.5")).toContainEqual({ kind: "clause", value: "52.212-1", loose: true });
    expect(parseReference("Proposal Instructions C.3.a")).toContainEqual({ kind: "clause", value: "52.212-1", loose: true });
    expect(parseReference("FAR 52.219-14")).toEqual([{ kind: "clause", value: "52.219-14" }]);
  });
  it("reads keys from extracted items by document", () => {
    expect(itemKeys({ source_section: "C.1.6.7.9", doc_kind: "pws" })).toEqual([{ kind: "pws", value: "1.6.7.9" }]);
    expect(itemKeys({ source_section: "Solicitation Continuation (FAR 52.219-14)", doc_kind: "solicitation" })).toEqual([{ kind: "clause", value: "52.219-14" }]);
    expect(itemKeys({ source_section: "C.3.a", doc_kind: "solicitation" })).toEqual([{ kind: "instruction", value: "c.3.a" }]);
  });
  it("covers sub-sections and ranges, but not siblings", () => {
    const k = (v: string, end?: string) => ({ kind: "pws" as const, value: v, ...(end ? { end } : {}) });
    expect(refCovers(k("1.6.7"), k("1.6.7.9"))).toBe(true);
    expect(refCovers(k("1.6.7"), k("1.6.70"))).toBe(false);
    expect(refCovers(k("5.4.1.6", "5.4.1.8"), k("5.4.1.7.2"))).toBe(true);
    expect(refCovers(k("5.4.1.6", "5.4.1.8"), k("5.4.1.10"))).toBe(false);
    expect(refCovers(k("1.5.4", "1.5.5"), k("1.5.5.1"))).toBe(true);
  });
});

describe("instruction labels", () => {
  it("reads instruction and addendum labels from extracted items", () => {
    expect(itemKeys({ source_section: "C.3.b.ii", doc_kind: "solicitation" })).toContainEqual({ kind: "instruction", value: "c.3.b" });
    expect(itemKeys({ source_section: "Addendum to 52.212-1, A.4", doc_kind: "solicitation" })).toContainEqual({ kind: "instruction", value: "a.4" });
    expect(itemKeys({ source_section: "Addendum to FAR 52.212-1, Para 4", doc_kind: "solicitation" })).toContainEqual({ kind: "instruction", value: "a.4" });
  });
  it("reads addendum paragraphs from references", () => {
    expect(parseReference("Addendum 52.212-1 A.6")).toContainEqual({ kind: "instruction", value: "a.6" });
    expect(parseReference("Addendum A.6 / Proposal Instructions C.3.c")).toEqual(expect.arrayContaining([{ kind: "instruction", value: "a.6" }, { kind: "instruction", value: "c.3.c" }]));
  });
  it("groups instruction items under the row with the same paragraph and similar wording", () => {
    const rows = parseMatrixSheet(sheet(
      row("C010", "Submission", "Proposal Instructions C.2.b", "Page limits: General 5 pages; Technical 30 pages; Past Performance 10 pages."),
      row("C089", "Key Personnel", "Proposal Instructions C.3.b(ii)", "Submit resumes and signed Letters of Intent for PM, APM, and Financial Analyst."),
      row("C095", "Past Performance", "Proposal Instructions C.3.b Factor II", "Provide maximum three example projects."),
    )).rows;
    const plan = planImport(rows, [
      item("p", "C.2.b", "solicitation", "The proposal shall not exceed the following page limits: General 5 pages, Technical 30 pages, Past Performance 10 pages"),
      item("k", "C.3.b.ii", "solicitation", "Offerors must provide resumes and letters of intent for all three key positions; the Program Manager, Alternate Program Manager, and Financial Analyst."),
      item("x", "C.3.b.Factor II", "solicitation", "The firm shall provide a maximum of three example projects demonstrating recent and relevant past performance."),
      item("o", "C.3.b", "solicitation", "Offerors shall assume that the Government has no prior knowledge of their facilities."),
    ]);
    const of = (id: string) => plan.cover.find((c) => c.itemId === id)?.externalId ?? null;
    expect(of("p")).toBe("C010");
    expect(of("k")).toBe("C089");
    expect(of("x")).toBe("C095");
    expect(of("o")).toBeNull(); // same paragraph, unrelated wording
  });
  it("prefers the row sharing more words over a short row with a high percentage", () => {
    const rows = parseMatrixSheet(sheet(
      row("C089", "Key Personnel", "Proposal Instructions C.3.b(ii); Evaluation p.52", "Submit resumes and signed Letters of Intent for PM, APM, and Financial Analyst; each resume must map to every minimum qualification, education, experience and certification requirement in the PWS."),
      row("C095", "Past Performance", "Proposal Instructions C.3.b Factor II", "Provide maximum three example projects."),
    )).rows;
    const plan = planImport(rows, [item("k", "C.3.b.ii", "solicitation", "Offerors must provide resumes and letters of intent for all three key positions; the Program Manager, Alternate Program Manager, and Financial Analyst.")]);
    expect(plan.cover).toEqual([{ itemId: "k", externalId: "C089" }]);
  });
});

describe("classifyApplicability", () => {
  it("flags payment, equitable adjustment, option and joint-venture terms as post-award", () => {
    expect(classifyApplicability("The Contractor shall use the information in the Routing Data Table only to fill in fields in WAWF", "DFARS 252.232-7006(f)(3)")).toBe("post_award");
    expect(classifyApplicability("The amount of any request for equitable adjustment shall accurately reflect", null)).toBe("post_award");
    expect(classifyApplicability("total extension of performance shall not exceed 6 months", "FAR 52.217-8")).toBe("post_award");
    expect(classifyApplicability("enter the name and unique entity identifier of each party to the joint venture", null)).toBe("post_award");
  });
  it("keeps proposal requirements", () => {
    expect(classifyApplicability("Cover letter shall contain Company Name, UEI, CAGE", "Addendum to FAR 52.212-1, Para 3(a)")).toBe("proposal");
  });
});

describe("spreadsheet parsing", () => {
  it("finds the header below title rows and maps every column", () => {
    const s = sheet(row("C001", "Submission & Eligibility", "Addendum 52.212-1 A.1", "100% WOSB set-aside."));
    expect(findHeaderRow(s)).toBe(3);
    const p = parseMatrixSheet(s);
    expect(p.error).toBeUndefined();
    expect(Object.keys(p.columns)).toHaveLength(14);
    expect(p.rows[0]).toMatchObject({ external_id: "C001", reference: "Addendum 52.212-1 A.1", workflow_status: "drafted", criticality: "high", needs_clarification: false, verified: false });
  });
  it("normalizes statuses and criticality", () => {
    expect(["Ready", "Drafted", "Pending Customer", "Pending Government", "Pending Pricing", "Final Review", ""].map(normalizeWorkflowStatus))
      .toEqual(["ready", "drafted", "pending_customer", "pending_government", "pending_pricing", "final_review", "not_started"]);
    expect(["High", "medium", "LOW", "?"].map(normalizeCriticality)).toEqual(["high", "medium", "low", null]);
  });
  it("marks clarification, post-award rows, and skips blanks and duplicates", () => {
    const p = parseMatrixSheet(sheet(
      row("C034", "Post-Award Deliverables", "PWS 1.4.1 / TE2", "QCP draft due NLT 15 days after award.", "Drafted", "Yes"),
      ["", "", "", "", "", ""],
      row("C034", "Dup", "PWS 1.4.1", "Duplicate id."),
      ["C999", "No text"],
    ));
    expect(p.rows).toHaveLength(1);
    expect(p.rows[0]).toMatchObject({ applicability: "post_award", needs_clarification: true });
    expect(p.skipped).toBe(2);
  });
  it("reports a sheet without a usable header", () => {
    expect(parseMatrixSheet([["Name", "Value"], ["a", "b"]]).error).toMatch(/header/);
  });
});

describe("planImport", () => {
  const rows = parseMatrixSheet(sheet(
    row("C037", "Volume II", "PWS 1.6.7.3.1", "Personnel must have favorable FBI fingerprint check and initiate NACI."),
    row("C041", "Volume II", "PWS 1.6.5.1-1.6.5.3", "Contractor personnel must identify themselves as contractors; documents marked; ID badges."),
    row("C009", "Submission", "Proposal Instructions C.2.a", "Proposal must be readable; text pages portrait; landscape allowed for tables/charts."),
    row("C003", "Submission", "Addendum 52.212-1 A.3", "Proposal due 9:00 a.m. EST, 20 November 2026."),
    row("C120", "Submission", "FAR 52.219-14", "For services, contractor may not pay more than 50% to non-similarly situated subcontractors."),
  )).rows;
  const existing = [
    item("a", "C.1.6.7.3.1", "pws", "Contractor personnel shall have a favorable FBI fingerprint card check and initiate a NACI"),
    item("b", "C.1.6.5.2", "pws", "All documents shall clearly contain the contractor's company name"),
    item("c", "C.1.6.5.4", "pws", "Personnel shall always wear this ID badge in a visible area"),
    item("d", "Addendum to FAR 52.212-1, Para 2(a)", "solicitation", "All text pages shall be oriented in portrait; however, landscape orientation is acceptable for tables and/or charts"),
    item("e", "Addendum to FAR 52.212-1, Para 4", "solicitation", "Written questions shall be submitted electronically NO LATER THAN, 9:00 a.m., EST, 3 November 2026."),
    item("f", "Solicitation Continuation (FAR 52.219-14)", "solicitation", "An independent contractor shall be considered a subcontractor."),
    item("g", "C.1.6.7.9", "pws", "New contract employees shall complete Level I OPSEC training"),
  ];
  const plan = planImport(rows, existing);
  const coverOf = (id: string) => plan.cover.find((c) => c.itemId === id)?.externalId ?? null;

  it("inserts every row as a master requirement", () => {
    expect(plan.inserts.map((r) => r.external_id)).toEqual(["C037", "C041", "C009", "C003", "C120"]);
  });
  it("groups detailed PWS items under the row whose section covers them", () => {
    expect(coverOf("a")).toBe("C037");
    expect(coverOf("b")).toBe("C041");
  });
  it("leaves items outside every referenced section uncovered", () => {
    expect(coverOf("c")).toBeNull();
    expect(coverOf("g")).toBeNull();
    expect(plan.uncovered).toEqual(expect.arrayContaining(["c", "g"]));
  });
  it("matches instruction items by wording, not just the shared 52.212-1 clause", () => {
    expect(coverOf("d")).toBe("C009");
    expect(coverOf("e")).toBeNull(); // the questions deadline is not the proposal deadline
  });
  it("matches exact clause numbers", () => {
    expect(coverOf("f")).toBe("C120");
  });
  it("refreshes rows already imported instead of duplicating them", () => {
    const again = planImport(rows, [...existing, item("m", "", null, "x", { origin: "import", external_id: "C037" })]);
    expect(again.updates).toEqual([{ id: "m", row: rows[0] }]);
    expect(again.inserts).toHaveLength(4);
  });
});

describe("mergeExtracted", () => {
  const masters = [{ external_id: "C053", reference: "PWS 5.2.1", text: "Daily monitor official phone/mailbox; answer 95% of calls within 4 rings" } as ImportRow];
  const existing = [item("x", "C.1.6.2", "pws", "The contractor shall be responsible for conducting business between the hours of 7:30 am and 4:00 pm")];

  it("skips requirements that already exist and never removes anything", () => {
    const r = mergeExtracted(existing, masters, [{ req_number: "C-1.6.2.1", shall_text: "The contractor shall be responsible for conducting business between the hours of 7:30 am and 4:00 pm (ET)", source_section: "C.1.6.2", doc_kind: "pws" }]);
    expect(r.inserts).toHaveLength(0);
    expect(r.duplicates).toHaveLength(1);
  });
  it("adds new items and links them to the master row that covers their section", () => {
    const r = mergeExtracted(existing, masters, [
      { req_number: "C-5.2.1.1", shall_text: "The contractor shall answer 95% of calls within four rings.", source_section: "C.5.2.1", doc_kind: "pws" },
      { req_number: "C-5.6.1.1", shall_text: "The contractor shall log incoming checks.", source_section: "C.5.6.1", doc_kind: "pws" },
    ]);
    expect(r.inserts.map((i) => i.cover_external_id)).toEqual(["C053", null]);
  });
  it("treats identical text under a different label as a duplicate", () => {
    const old = [item("q", "Addendum to FAR 52.212-1, Para 4", "solicitation", "Questions shall identify the PWS paragraph number or solicitation reference with each question.")];
    const r = mergeExtracted(old, [], [{ req_number: "A.4-3", shall_text: "Questions shall identify the PWS paragraph number or solicitation reference with each question.", source_section: "Addendum to 52.212-1, A.4", doc_kind: "solicitation" }]);
    expect(r.duplicates).toHaveLength(1);
  });

  it("de-duplicates within the same batch", () => {
    const same = { req_number: "C-5.6.1.1", shall_text: "The contractor shall log incoming checks within three days.", source_section: "C.5.6.1", doc_kind: "pws" as const };
    const r = mergeExtracted([], [], [same, { ...same, req_number: "C-5.6.1.1b" }]);
    expect(r.inserts).toHaveLength(1);
  });
});

describe("batchSections", () => {
  const sec = (n: string, content: string, title = "") => ({ document_id: "d", file_name: "PWS.pdf", section_number: n, section_title: title, content, page_start: 1 });

  it("includes binding sections and exhibit/evaluation sections, skips the rest", () => {
    expect(isRequirementSection(sec("5.2.1", "The contractor shall answer calls."))).toBe(true);
    expect(isRequirementSection(sec("TE1", "Program Management | 1 late deliverable", "Technical Exhibit 1 Performance Requirements Summary"))).toBe(true);
    expect(isRequirementSection(sec("2.1", "Definitions: ACED means Army Continuing Education Division."))).toBe(false);
  });
  it("reads every section, including the ones past the old 60-section cutoff", () => {
    const many = Array.from({ length: 150 }, (_, i) => sec(`5.${i}`, `The contractor shall perform task ${i}. `.repeat(20)));
    const batches = batchSections(many, 16_000);
    const all = batches.flat().join("\n");
    expect(all).toContain("[PWS.pdf | 5.149 ");
    expect(batches.every((b) => b.join("").length <= 16_000 + 6_200)).toBe(true);
  });
  it("splits a long section instead of cutting it off", () => {
    const long = sec("5.6", "The contractor shall reconcile refunds. ".repeat(400));
    const blocks = batchSections([long], 100_000, 6_000).flat();
    expect(blocks.length).toBeGreaterThan(1);
    expect(blocks[1]).toContain("(continued)");
    expect(blocks.join("").length).toBeGreaterThan(long.content.length);
  });
});
