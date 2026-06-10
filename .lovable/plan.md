
## Why the Top Secret clearance was missed

The clearance is mentioned exactly **once** in Attachment J7 (DOW) at **Section 1.3.2 "Required Credentials," page 9**. Walking through `supabase/functions/analyze-solicitation/index.ts`, several things stack against a single-mention item like this:

1. **Section 1.3.2 is not "priority."** The priority detector only flags Section L, M, 4.x, 5.x, or titles like "Instructions to Offerors," "Evaluation," "Submission," "Eligibility." A DOW's `1.3.2 Required Credentials` matches **none** of those — so it competes for budget with everything else in the doc.
2. **Attachments share the same char budget as the main RFQ.** With 11 documents and a 180k total budget, J7 gets ~16k chars total. After the first ~3 non-priority sections (4k each), the budget for J7 is exhausted before the model reaches §1.3.2 on page 9.
3. **No keyword-level safety net.** A single sentence containing "Top Secret" anywhere in a 600-page corpus has no special path to the model. The pipeline is purely section-ordered + priority-flagged.
4. **No dedicated category/requirement type for personnel security.** The schema has `staffing` but the prompt's emphasis is on submission gates and technical scope. A lone clearance line easily falls out of the top-25 ranking.
5. **No post-extraction sanity check** for "did the analysis surface any clearance / citizenship / certification requirement at all?" — only generic coverage warnings on priority sections.

## Recommended fix

A layered approach. Each layer is independently valuable.

### Layer 1 — Critical-keyword sweep (highest ROI)

Before building the AI prompt, scan **every** section's content (across all documents, no truncation) with a curated keyword regex. Any section that hits gets:
- Promoted to **priority** (full 8,000-char slice, placed at the front of its document block).
- Tagged in the prompt with a `*CRITICAL KEYWORD: <term>*` marker so the model knows it must surface a requirement from this section.

Initial keyword set (configurable):

```text
clearance:    Top Secret, TS/SCI, TS\b, Secret\b, Confidential clearance,
              Public Trust, clearance, cleared personnel
citizenship:  U.S. citizen, US citizenship, citizenship required
credentials:  Required Credentials, certifications? required,
              CISSP|Security\+|CompTIA|PMP|ITIL
section titles: required credentials, personnel requirements,
                qualifications, security requirements, key personnel
```

Effect on this case: J7 §1.3.2 contains "Top Secret" → section gets promoted and tagged, model sees it with full content and an explicit instruction.

### Layer 2 — Expand the priority detector

Add to `PRIORITY_SECTION_TITLE_RX`:
`required credentials|qualifications|personnel|key personnel|security requirement|clearance`.

This catches DOW/PWS subsections that today are invisible to the prioritizer.

### Layer 3 — Personnel & clearance category in schema + prompt

- Add `personnel_security` to the `category` enum (or reuse `compliance` but require a `subcategory`).
- Prompt instruction: *"You MUST extract every personnel clearance, citizenship, and certification requirement — even if mentioned only once across all documents. These are bid-eligibility gates."*

### Layer 4 — Post-extraction "did we catch it?" validator

After the model returns, run the same critical-keyword regex against all source sections. For each hit, check whether any `key_requirement.source.quote` or `text` contains the same keyword. If a keyword fires in the source but never appears in the output:

```
validation_warnings += {
  field: "missing_requirement",
  severity: "error",
  message: `"Top Secret" appears in "J7 DOW" §1.3.2 (p.9) but no
            extracted requirement references it. Review and add
            manually.`
}
```

Surface these as **red** banners on the dashboard (a step up from the amber coverage warnings already shown).

### Layer 5 — Targeted second pass for personnel/security (optional)

A small follow-up AI call that receives only the keyword-flagged sections and emits a focused list of personnel/security/clearance/citizenship/certification requirements. Merge into `key_requirements` deduped by quote. Runs in parallel; ~5–8s extra; uses cheap `gemini-2.5-flash`.

## Options

| Option | Effort | Effectiveness | Notes |
|---|---|---|---|
| **A. Minimal** — Layer 2 only (expand priority title regex) | ~15 min | Low–Med | Helps if the section title includes "credentials," misses if buried. |
| **B. Targeted** — Layers 1 + 2 + 3 (keyword sweep + schema) | ~2 hrs | High | Best ROI. Directly fixes this miss + similar single-mention items. |
| **C. Robust** — Layers 1 + 2 + 3 + 4 (adds red validation banner) | ~3 hrs | Very high | Visible safety net: future single-mention misses self-report. |
| **D. Belt-and-suspenders** — All five layers including 2nd-pass | ~5 hrs | Highest | Doubles model cost on analysis. Recommended for cleared work. |

**Recommendation: Option C.** The keyword sweep + expanded priority detector catches this class of miss at retrieval time, and the post-extraction validator turns any remaining miss into a visible red banner the user can act on. Layer 5 can be added later if cleared/IC work becomes a frequent use case.

## User-configurable keyword list (suggested)

To avoid hardcoding forever, store the keyword set in `solicitations.lens_overrides` (already supported) or on the client profile as `critical_keywords: string[]`. Default seed list above; clients in classified work can extend.

## Files that would change

- `supabase/functions/analyze-solicitation/index.ts` — keyword sweep, expanded priority regex, prompt update, post-extraction validator.
- `src/features/analysis/prompts/solicitationAnalysis.ts` — add `personnel_security` category, extend `AnalysisValidationWarning` consumers if needed.
- `src/features/analysis/components/AnalysisDashboard.tsx` — render `severity: "error"` warnings as a red banner (distinct from amber coverage warnings).
- Optional: `src/features/clients/components/...` to expose a "Critical keywords" editor on the client profile.

No DB migration required (uses existing `metadata.analysis.validation_warnings` + `lens_overrides`).

## Re-running on this solicitation

After deploy, click **Re-run analysis**. The keyword sweep will promote J7 §1.3.2, the model will see the full section flagged `*CRITICAL KEYWORD: Top Secret*`, and the Top Secret clearance will appear as a critical `personnel_security` requirement. If anything is still missed, you will see a red "missing requirement" banner.

---

Pick A / B / C / D. **C is what I'd ship.**
