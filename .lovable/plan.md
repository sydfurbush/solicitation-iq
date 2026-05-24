## Goal
During Phase 5 drafting, prevent the AI from using hyphens as makeshift sentence/clause joiners while preserving legitimate hyphenation (compound modifiers, prefixes, technical terms).

## Where the rule belongs
Phase 5 generates and revises text through two edge functions:
- `supabase/functions/draft-section/index.ts` — first-pass draft (`SYSTEM_PROMPT`)
- `supabase/functions/polish-section/index.ts` — tighten / expand / rewrite-to-theme / compliance-check (system message in `callAiTool`)

Both call Lovable AI and return Markdown that lands in `proposal_drafts.content_json.markdown`. Adding the rule once per system prompt covers every AI write path into a draft. No schema or UI changes needed.

## Rule text to add (shared, identical in both functions)
A new "PUNCTUATION" block:

> PUNCTUATION — HYPHEN USAGE:
> - Do NOT use a hyphen (`-`) or a pair of hyphens (`--`) to join independent clauses, separate thoughts, or stand in for sentence punctuation. Replace such hyphens with the correct mark: a period for separate sentences, a semicolon for closely related independent clauses, a comma for a non-essential clause, or an em dash (`—`) only when an emphatic parenthetical break is stylistically warranted.
> - PRESERVE hyphens that are grammatically required: compound modifiers before a noun (e.g. "cloud-native architecture", "low-risk approach"), prefixed words (e.g. "pre-award", "non-conforming", "re-baseline"), and standard hyphenated terms.
> - PRESERVE hyphens inside technical, contractual, or industry-specific terms verbatim (e.g. "FAR 52.212-4", "NAICS 541-330", "ISO 27001-compliant", "SOC 2 Type-II", part numbers, CLIN identifiers, CDRL designators, contract line items).
> - Never insert a hyphen where a comma or period would be grammatically correct.

## Files to change
1. `supabase/functions/draft-section/index.ts` — append the PUNCTUATION block to `SYSTEM_PROMPT` (after the existing FORMATTING line, before "Avoid: marketing fluff…").
2. `supabase/functions/polish-section/index.ts` — append the same block to the `system:` string passed into `callAiTool` (after the existing FORMATTING sentence).

Both functions are auto-deployed on save.

## Out of scope
- No regex post-processor. Reliably distinguishing a "joiner hyphen" from a compound-modifier hyphen in arbitrary prose is exactly what we're asking the model to do; a regex would either miss cases or damage legitimate terms like `FAR 52.212-4`. We rely on the prompt rule and can add a targeted post-processor later if reviewers see recurring misses.
- No change to the outline, format profile, or compile step.
- No change to the editor UI — the rule applies at generation time only.

## Verification
After the edit, generate a new section draft on a Phase 5 node and run a Polish → Tighten on an existing draft. Confirm hyphen-as-joiner instances are replaced with proper punctuation and that compound modifiers / clause references like `FAR 52.212-4` are untouched.
