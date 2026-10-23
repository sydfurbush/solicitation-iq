# AGENTS.md — client onboarding

Read the root AGENTS.md first.

## Client onboarding (document intake and triage)

- New clients upload documents through the client portal (staff can upload on their behalf) into the private `client-onboarding` storage bucket, tracked in `client_onboarding_documents`.
- `triage-onboarding-document` classifies each file and stores the result in `client_onboarding_triage`, which only staff can read. Clients see only their own files and a status.
- Routing rules and the pricing, personal-data, signature and solicitation-number detectors live in `supabase/functions/_shared/onboardingTriage.ts`. The detectors can only make routing stricter than the AI's answer; never loosen that.
- Destinations: Profile source (facts for the company profile), Knowledge base (reusable writing; only after cleaning if flagged), Restricted (pricing, personal data, signatures; never available to drafting) and Not needed.
- Each onboarding document records how it arrived: `received_via` (`portal` | `email` | `other`; clients can only insert `portal`), `received_from` (sender name/email) and `received_on` (date received), so profile facts can be traced to their source.
- Partners and subcontractors: triage records whose company each document is about (`subject`: client, partner, government, other), the partner names and the client's role (prime or sub). A partner's documents go to **Partner profile**, never to the client's profile or knowledge base, so a partner's certifications, past performance or staff are never presented as the client's own. Teaming agreements, subcontract agreements and NDAs record the relationship in the client's profile; their negotiated terms (workshare, exclusivity, payment) stay restricted.
- Existing knowledge files can be re-checked with `recheck-knowledge-document` (staff only). It copies the file into onboarding once, linked by `knowledge_document_id`, and runs the same triage via `supabase/functions/_shared/triageRunner.ts`. Typed notes are not re-checked.
- Nothing from onboarding goes into the client knowledge base automatically in Phase 1. Staff confirm each document's destinations first.

