# Anchor analysis to known structured fields + cross-check summary

## Goal

Stop the AI from contradicting structured solicitation metadata (set-aside, NAICS, agency, contract number, etc.) when it generates the executive summary. The current run produced "WOSB" in the summary even though `set_aside = '8(a)'` because the SF1449 cover sheet boilerplate says "WOMEN-OWNED SMALL BUSINESS (WOSB)" and nothing told the model to defer to the structured field.

## Changes (all in `supabase/functions/analyze-solicitation/index.ts`)

### 1. Pass known facts into the prompt

Before building the user prompt, fetch the solicitation row (we already have `solicitationId`) and pull:
- `set_aside`
- `solicitation_number`
- `issuing_agency`
- `agency_type`
- `contract_type`
- `incumbent_name`, `incumbent_contract_number`
- `release_date`, `proposal_due_date`, `questions_due_date`
- `period_of_performance_start`, `period_of_performance_end`
- `estimated_value_low`, `estimated_value_high`
- `client.name` (via existing join pattern)

### 2. New "KNOWN FACTS" block in the user prompt

Prepend a block before the document excerpts:

```
=== KNOWN FACTS (authoritative — do not contradict) ===
Set-Aside: 8(a)
Solicitation #: W9124D26RA041
Issuing Agency: ...
Contract Type: FFP
Proposal Due: 2026-05-20
(only include fields that are non-null)
```

Only include fields that have values. Skip nulls so we don't tell the model "Set-Aside: null".

### 3. Strengthen the system prompt

Add two rules near the top:

> - When a "KNOWN FACTS" block is provided, treat those values as authoritative. Do NOT restate them with different values, even if the document text suggests otherwise (cover sheets and SF1449 templates often contain misleading boilerplate like "WOMEN-OWNED SMALL BUSINESS (WOSB) SOLICITATION" headers that are not the actual set-aside designation).
> - The executive_summary MUST be consistent with the KNOWN FACTS. If the documents conflict with a known fact, mention the conflict in `risk_signals` instead of changing the summary.

### 4. Post-generation validation + auto-correction

After `callAiTool` returns, run a lightweight check on `analysis.executive_summary`:

```ts
const SET_ASIDE_TERMS: Record<string, RegExp> = {
  "8(a)": /\b8\s*\(\s*a\s*\)/i,
  "WOSB": /\bWOSB\b|women[-\s]?owned\s+small\s+business/i,
  "EDWOSB": /\bEDWOSB\b/i,
  "SDVOSB": /\bSDVOSB\b|service[-\s]?disabled/i,
  "HUBZone": /\bHUB[-\s]?Zone\b/i,
  "SDB": /\bSDB\b|small\s+disadvantaged\s+business/i,
  "Total Small Business": /total\s+small\s+business/i,
};
```

If `solicitation.set_aside` is present:
- For every other key in `SET_ASIDE_TERMS` whose regex matches the summary AND is not the actual set-aside, log a warning to `metadata.analysis.validation_warnings` with `{ field: "set_aside", expected, found_in_summary }`.
- If the summary mentions any *wrong* set-aside, append a clarifying sentence at the start of `executive_summary`: `"This solicitation is a ${set_aside} set-aside."` and strip/replace obvious wrong mentions where safe (only do replacement for whole-word matches; otherwise just prepend).

Same approach for `solicitation_number` (if present and the summary contains a different RFP number pattern `[A-Z0-9]{8,}`, flag it).

Store the warnings in `metadata.analysis.validation_warnings` so they're visible later (could be surfaced in UI, but no UI changes in this plan).

### 5. UI surfacing (small)

In `src/pages/SolicitationAnalysis.tsx` (or wherever the AI analysis card is rendered — verify), if `metadata.analysis.validation_warnings` is non-empty, show a small amber `Alert` above the executive summary: "AI summary may conflict with known fields: …" with the offending term(s). Read-only; no actions.

## Out of scope

- Changing prompts for other functions (questions, risks, report). Same pattern can be applied later if useful.
- Re-extracting structured fields from documents. Known facts come from the solicitation row only.
- Editing the existing summary for this solicitation — user can hit "Re-run analysis" after deploy.

## Verification

1. Deploy `analyze-solicitation`.
2. On solicitation `0d2c19f3...`, click "Re-run analysis".
3. Confirm:
   - The new `executive_summary` says "8(a)" (or at minimum doesn't say WOSB).
   - `metadata.analysis.validation_warnings` is empty (or contains the flagged old behavior if the model still slips).
4. Check logs for `[analyze-solicitation] known_facts=...` debug line.
