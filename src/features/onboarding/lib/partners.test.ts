import { describe, it, expect } from "vitest";
import { agreementPartiesLabel, matchesExtraFilter, shouldLeaveKnowledge, whoseDocumentLabel } from "./onboardingFiles";

describe("whose document", () => {
  it("labels each subject", () => {
    expect(whoseDocumentLabel({ subject: "client" })).toBe("Client");
    expect(whoseDocumentLabel({ subject: "partner", subject_name: "Acme Corp" })).toBe("Partner · Acme Corp");
    expect(whoseDocumentLabel({ subject: "government" })).toBe("Government");
    expect(whoseDocumentLabel({ subject: "other" })).toBe("Other");
  });
  it("shows agreement parties and client role", () => {
    expect(agreementPartiesLabel({ doc_type: "nda", partner_names: ["Acme"], client_role: "prime" })).toBe("With Acme · Prime");
    expect(agreementPartiesLabel({ doc_type: "subcontract_agreement", partner_names: [], client_role: "sub" })).toBe("Sub");
    expect(agreementPartiesLabel({ doc_type: "capability_statement", partner_names: ["Acme"] })).toBe("");
  });
});

describe("partner and knowledge filters", () => {
  it("partners includes partner subjects and agreements only", () => {
    expect(matchesExtraFilter("partners", {}, { subject: "partner" })).toBe(true);
    expect(matchesExtraFilter("partners", {}, { subject: "client", doc_type: "teaming_agreement" })).toBe(true);
    expect(matchesExtraFilter("partners", {}, { subject: "client", doc_type: "resume" })).toBe(false);
  });
  it("from knowledge requires a linked knowledge file", () => {
    expect(matchesExtraFilter("from_knowledge", { knowledge_document_id: "k1" }, null)).toBe(true);
    expect(matchesExtraFilter("from_knowledge", { knowledge_document_id: null }, null)).toBe(false);
  });
  it("flags linked files whose destinations exclude knowledge", () => {
    const t = { destinations: ["restricted"], final_destinations: null, requires_cleaning: false, reviewed_at: null };
    expect(shouldLeaveKnowledge({ knowledge_document_id: "k1" }, t)).toBe(true);
    expect(shouldLeaveKnowledge({ knowledge_document_id: "k1" }, { ...t, destinations: ["knowledge"] })).toBe(false);
  });
});