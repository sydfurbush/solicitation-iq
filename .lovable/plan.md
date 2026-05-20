# Make "Suggest" mitigation read like proposal prose

## Goal

When a user clicks Suggest (or Suggest again) on a risk, the AI should return a polished, proposal-ready narrative section — written as if it will be dropped directly into the submitted proposal — instead of the current labeled `Approach: / Owner: / Evidence:` lines.

No other AI steps in the app change. Only the `suggest-risk-mitigation` edge function prompt and its tool schema description are updated.

## Scope

- Edit only `supabase/functions/suggest-risk-mitigation/index.ts`.
- No UI changes, no schema/migration changes, no changes to other AI functions (identify-risks, generate-questions, generate-report, polish-section, etc.).

## What changes

1. **System prompt** rewritten to instruct the model to:
   - Write 1–2 cohesive paragraphs (150–250 words) in third person, professional proposal voice ("The team will…", "Our approach…").
   - Read as a finished proposal section a capture manager could paste in with minor edits.
   - Still ground every claim in the Client Lens; cite knowledge as inline `[K#]` tags where used; if no supporting evidence exists, surface that honestly in-line ("No directly applicable past performance is on file; recommend sourcing a reference before submission.").
   - No labeled lines, no bullets, no markdown headers, no preamble like "Here is the mitigation".
   - Stay specific to this risk and this client; avoid generic platitudes.
   - Never recommend marking the risk mitigated.

2. **Tool schema description** for `mitigation_strategy` updated from "Plain-text paragraph with Approach / Owner / Evidence lines." to describe the proposal-style narrative.

3. Everything else in the function (auth, risk lookup, Client Lens build, used_sources return, error handling) stays exactly the same.

## Out of scope

- Risk identification, questions generation, reports, polish-section, and any other AI workflows.
- UI in `RiskMitigationTracker` / `ClientRiskTracker` (already renders `mitigation_strategy` as plain text — new prose format works without changes).
- Database fields and RLS.
