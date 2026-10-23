import { describe, expect, it } from "vitest";
import type { RequirementItem } from "../hooks/useRequirementItems";
import { groupRequirements, rollupGroup, matchesMatrixFilters, matrixCsv, CSV_COLUMNS, validateMatrixFile, type MatrixFilters } from "./matrix";
const req = (id: string, patch: Partial<RequirementItem> = {}): RequirementItem => ({ id, req_number: id, covered_by_id: null, applicability: "proposal", workflow_status: "not_started", area: "Technical", needs_clarification: false, shall_text: "Must comply", ...patch } as RequirementItem);
const filters: MatrixFilters = { applicability: "proposal", area: "all", status: "all", criticality: "all", clarification: false, gapsOnly: false };
describe("master matrix", () => {
  it("groups details under masters and preserves standalone items", () => {
    const groups = groupRequirements([req("C001"), req("R001", { covered_by_id: "C001" }), req("R002")]);
    expect(groups.map(g => [g.master.id, g.details.map(d => d.id)])).toEqual([["C001", ["R001"]], ["R002", []]]);
  });
  it("rolls linked and cited details up to their master", () => {
    const group = { master: req("C001"), details: [req("R001", { covered_by_id: "C001" })] };
    const rollup = rollupGroup(group, [{ id: "section", linked_requirement_ids: ["R001"] }], [{ outline_node_id: "section", content_html: "Evidence [Req-R001]" }]);
    expect(rollup).toMatchObject({ linked: true, cited: true, drafted: true, gap: false });
  });
  it("a master can itself be linked and cited", () => {
    expect(rollupGroup({ master: req("C001"), details: [] }, [{ id: "n", linked_requirement_ids: ["C001"] }], [{ outline_node_id: "n", content_html: "[Req-C001]" }])).toMatchObject({ linked: true, cited: true, gap: false });
  });
  it("unlinked uncited items remain gaps", () => {
    expect(rollupGroup({ master: req("R001"), details: [] }, [], [])).toMatchObject({ linked: false, cited: false, gap: true });
  });
  it("defaults to proposal requirements, excluding post-award", () => {
    const group = { master: req("A", { applicability: "post_award" }), details: [] };
    expect(matchesMatrixFilters(group, filters, true)).toBe(false);
    expect(matchesMatrixFilters(group, { ...filters, applicability: "post_award" }, true)).toBe(true);
    expect(matchesMatrixFilters(group, { ...filters, applicability: "all" }, true)).toBe(true);
  });
  it.each([['area', 'Legal'], ['status', 'ready'], ['criticality', 'high'], ['clarification', true], ['gapsOnly', true]] as const)("applies %s filter", (key, value) => {
    expect(matchesMatrixFilters({ master: req("A"), details: [] }, { ...filters, [key]: value }, false)).toBe(false);
  });
  it("exports all requested columns, editable values and detail relationship", () => {
    const csv = matrixCsv([{ master: req("C001", { response_evidence: 'A "quote", evidence', action_needed: "Ask agency", compliance_owner: "Sydney", workflow_status: "ready", criticality: "high", needs_clarification: true }), details: [req("R001", { covered_by_id: "C001" })] }], [], []);
    expect(CSV_COLUMNS).toEqual(["ID", "Area", "Type", "Reference", "Requirement", "Proposal location", "Status", "Criticality", "Owner", "Needs clarification", "Link/draft/cited status", "Response/evidence", "Action needed", "Verified at", "Verified by", "Applicability", "Master ID"]);
    expect(csv).toContain('"Ready","high","Sydney","Yes","Gap","A ""quote"", evidence","Ask agency"');
    expect(csv.split("\r\n")[2]).toMatch(/,"C001"$/);
  });
  it("accepts only spreadsheet extensions", () => {
    expect(validateMatrixFile({ name: "matrix.xlsx", size: 1 })).toBeNull();
    expect(validateMatrixFile({ name: "matrix.xls", size: 1 })).toBeNull();
    expect(validateMatrixFile({ name: "matrix.csv", size: 1 })).toBeNull();
    expect(validateMatrixFile({ name: "matrix.pdf", size: 1 })).not.toBeNull();
  });
  it("enforces the 5 MB upload limit", () => {
    expect(validateMatrixFile({ name: "matrix.xlsx", size: 5 * 1024 * 1024 })).toBeNull();
    expect(validateMatrixFile({ name: "matrix.xlsx", size: 5 * 1024 * 1024 + 1 })).not.toBeNull();
  });
});
