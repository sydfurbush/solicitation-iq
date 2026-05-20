# Risk Mitigation Improvements

Implement three improvements to the Risk Mitigation workflow so clients/team produce stronger, reusable mitigation content for downstream proposal drafting.

## Scope

Targeting `RiskMitigationTracker` (Phase 1 → Risks step) and the `RiskCard` mitigation block.

### #2 — "Suggest mitigation" AI button (per risk)

Add a per-risk AI button that drafts a tailored mitigation paragraph using the client's actual context — not just solicitation language.

- New button in `UnmitigatedRow` (RiskMitigationTracker) and inside `RiskCard` mitigation block when risk is open.
- Label: "Suggest mitigation" when textarea empty, "Suggest again" when not. If not empty, confirm before replacing.
- Calls a new edge function `suggest-risk-mitigation` with `{ riskId }`.
- Edge function gathers context:
  - The risk (title, description, severity, source_quote, source_citation)
  - Solicitation overview (title, agency, contract type, set-aside, incumbent info)
  - Client profile + capability templates (`client_profiles`, `capability_templates`)
  - Top-matching client knowledge chunks via `match_client_knowledge` (past performance, certs, tooling) using the risk text as the query
  - Existing mitigation_strategy (if user wants "improve" rather than replace)
- Prompts Lovable AI (`google/gemini-2.5-flash`) to return a single mitigation paragraph structured as **Approach / Owner / Evidence** (plain text, labeled lines) so the same output is reusable downstream and renders cleanly in the textarea.
- Returns `{ mitigation_strategy: string, used_sources: [{document_title, snippet}] }`.
- UI inserts text into the local textarea state (user must still click Save notes to persist) and shows a small "AI suggested" pill + collapsible "Sources used" list under the textarea.

### #3 — Require notes before "Mark mitigated"

Soft validation in `UnmitigatedRow` and `RiskCard`:

- Disable the "Mark mitigated" button when `mitigation_strategy` (saved value) is empty/whitespace.
- Tooltip on hover: "Add mitigation notes before marking mitigated."
- If user has unsaved text in the textarea, show inline hint: "Save notes first, then mark mitigated."
- No DB constraint change — purely UX guard so rationale is always captured.

### #4 — "Convert to clarification question" action

Add a secondary action on each open risk that pushes it into the Questions workflow when the team can't mitigate it internally.

- Button: "Ask the agency" (icon: MessageCircleQuestion) next to Save notes / Mark mitigated.
- Opens a small dialog prefilled with:
  - Question text (AI-derived one-liner from risk title + description, or simple template: "Regarding {risk.title}: can the agency clarify…")
  - Category dropdown (default: clarification)
  - Priority (default mirrors risk.severity → critical/high → high; medium → medium; low → low)
  - Source citation copied from risk
- On submit: inserts into `strategic_questions` via existing `useStrategicQuestions` create mutation, links back to the risk by storing `risk_id` in metadata (no schema change required — use existing notes/metadata field if present; otherwise add `strategic_advantage_notes` prefix "From risk: {title}").
- Toast: "Added to Questions" with action link to Questions tab.
- Optional small badge on the risk card after conversion: "Sent to Questions" (driven by checking if any question references this risk id in its notes/metadata — best-effort, no schema migration).

## Technical notes

- New edge function: `supabase/functions/suggest-risk-mitigation/index.ts`. Uses service role, validates JWT in code, CORS via `npm:@supabase/supabase-js@2/cors`. Zod-validates `{ riskId: uuid }`.
- Reuses `_shared/aiClient.ts` (`callAiTool` or simple `callAi`) and `_shared/clientLens.ts` to build the client context block, plus `_shared/embeddings.ts` to embed the risk text for `match_client_knowledge`.
- New hook `useSuggestRiskMitigation(solicitationId)` in `src/features/risks/hooks/` calling `supabase.functions.invoke("suggest-risk-mitigation", { body: { riskId } })`.
- No database migration needed for #2 and #3.
- For #4: if we want a clean back-link, we can add a nullable `source_risk_id uuid` column to `strategic_questions` in a follow-up. For this plan, store the link inside an existing free-text field to avoid a migration; flag this as a known limitation.

## Files touched

- `supabase/functions/suggest-risk-mitigation/index.ts` (new)
- `src/features/risks/hooks/useSuggestRiskMitigation.ts` (new)
- `src/features/risks/hooks/useConvertRiskToQuestion.ts` (new)
- `src/features/risks/components/ConvertRiskToQuestionDialog.tsx` (new)
- `src/features/analysis/components/RiskMitigationTracker.tsx` (edit — add buttons + guard)
- `src/features/risks/components/RiskCard.tsx` (edit — add Suggest + Ask agency + guard)

## Out of scope

- Structured Approach/Owner/Evidence as separate DB columns (option #1) — kept as a single textarea; AI output uses labeled lines so it reads structured without a schema change.
- Risk → Capability gap link (option #5).
