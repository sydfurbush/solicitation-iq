
## Why the SMA requirement was missed

Looking at `supabase/functions/analyze-solicitation/index.ts`, three concrete causes — any one of which would drop this requirement:

1. **Hard cap of 10 key requirements.** Prompt says "Return at most 10" and the UI shows exactly 10. With ~7 attachments, mandatory submission rules compete with technical/staffing items and routinely lose.
2. **Section truncation at 40 per document.** `sections.slice(0, 40)` per doc. Section 4.2.1 on page 20 of a long RFQ can fall outside the first 40 ordered sections — especially when L/M is grouped late.
3. **Per-document char budget split.** `180k / docCount` then 4k per section slice. With many attachments the main RFQ gets very little room; Section 4 "Instructions to Offerors" content gets sliced off before the model sees the SMA submission rule.

Additionally, there's no schema-level requirement that the model surface "submission/eligibility prerequisites" (must-submit, minimum scope, page limits, format gates). The prompt asks for "key requirements" generically — the model picks 10 it considers important, and bid-eligibility gates get treated as one category among many.

## Recommended fix (combined, lowest risk)

A layered approach. Each layer is independently valuable; together they make this class of miss very unlikely.

### Layer 1 — Remove the 10-item ceiling, add mandatory categories (prompt + schema)
- Raise key_requirements cap from 10 to 25 and reorder priority guidance to put **bid-eligibility / submission gates first**.
- Add explicit category `submission` to the enum (currently: technical, management, staffing, compliance, other).
- Add an instruction in the system prompt:
  > "ALWAYS extract requirements from Section L (Instructions to Offerors), Section M (Evaluation), and any 'Proposal Submission' / 'Eligibility' / 'Minimum Requirements' sections. Every must-submit, minimum-scope, page-limit, or proposal-volume rule is a critical requirement and must appear in key_requirements."

### Layer 2 — Section-aware retrieval (most impactful)
Replace the blind `slice(0, 40)` with a prioritized selector that always includes the L/M / submission sections regardless of position:

```text
priority sections (always included, full content):
  - section_number matching ^L\b|^M\b|^4\.|^5\.
  - section_title matching /instructions to offerors|proposal submission|
    evaluation|eligibility|minimum requirements|basis for award|BPA award/i
then fill remaining budget with the rest in sort_order.
```

Also raise per-section slice from 4,000 → 8,000 chars for priority sections and keep 4,000 for the rest.

### Layer 3 — Two-pass extraction for submission rules
Run a small **second AI call** focused only on submission/eligibility rules from the priority sections, with its own schema. Merge results into `key_requirements` deduped by quote/section. This guarantees those rules survive even if the main pass under-weights them. Uses cheaper `gemini-2.5-flash` and runs in parallel with the main call — adds ~5–10s, no UX impact (background job).

### Layer 4 — Validation + visible coverage warnings
After extraction, run heuristic checks against the source sections:
- Are there results from Section L/M / "Proposal Submission"? If a priority section exists but no requirement cites it, push a warning into `metadata.analysis.validation_warnings` and surface it on the dashboard as a yellow banner: "No requirements extracted from Section 4.2 — review manually."
- Show a `Coverage` chip per source document on the dashboard (sections cited / sections present).

### Layer 5 — "Add missing requirement" user action (already partially present via requirement_items)
Add a one-click **"Add as Key Requirement"** button in the Key Requirements panel so when a user spots a gap, they can paste/cite it inline. Persist to `key_requirements` with a `source.added_by: user` flag, audited.

## Options to choose from

| Option | Effort | Effectiveness | Notes |
|---|---|---|---|
| **A. Minimal** — Layer 1 only (prompt + cap + submission category) | ~30 min | Medium | Cheapest; fixes the cap but not the truncation. |
| **B. Targeted** — Layers 1 + 2 (section-aware retrieval) | ~1–2 hrs | High | Best ROI. Directly addresses the cause for this specific miss. |
| **C. Robust** — Layers 1 + 2 + 4 (validation/coverage UI) | ~3–4 hrs | Very high | Adds visible coverage signals so future misses are caught. |
| **D. Belt-and-suspenders** — All five layers including 2nd-pass extraction | ~1 day | Highest | Two model calls per analysis; ~2× analysis cost. Recommended if eligibility gates are mission-critical. |

**My recommendation: Option C** for now. The combination of (a) lifting the cap, (b) always including L/M / "Proposal Submission" sections with full content, and (c) showing coverage warnings should reliably catch items like the SMA rule. We can add Layer 3 later if any further misses occur.

## Files that would change

- `supabase/functions/analyze-solicitation/index.ts` — prompt, schema (`submission` enum, cap raised), section selector, validation.
- `src/features/analysis/components/AnalysisDashboard.tsx` (and child requirement list) — render coverage warnings, optional "Add Key Requirement" action.
- `src/features/analysis/prompts/solicitationAnalysis.ts` — keep client-side types aligned with new enum value.
- No DB migration needed unless we want to persist coverage metadata explicitly (it already lives inside `metadata.analysis`).

## Re-running on existing solicitations

After deploy, click **Re-run analysis** on this solicitation. The new section-aware retrieval will pull Section 4.2.1 even though the doc is large. To bulk-refresh prior solicitations, we can add a small one-time admin button — out of scope unless you want it.

---

Pick A / B / C / D (or mix), and I'll implement. C is what I'd ship.
