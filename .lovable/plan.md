# Recalibrate the Competitive Position win indicator

## Why

The current formula sums every opportunity's `impact_score` (0–100 scale) and divides by 6, so a handful of opportunities pegs the score to 100% — especially right now, when the unmitigated-risk side is empty. It shows "100% win probability" even with no real basis.

## New formula

In `src/features/analysis/components/CompetitivePositionSummary.tsx`:

1. **Guard against missing data.** If there are no opportunities AND no risks at all (mitigated or not), don't show a number — render "—" with the helper text "Identify risks & opportunities to see a position estimate." This prevents a misleading 100% when the AI hasn't run successfully yet.

2. **Use averages, not sums.**
   - `oppLift` = average `impact_score` of opportunities on a 0–100 scale (0 if none). Treat this as the upside baseline.
   - `riskDrag` = sum of severity weights of unmitigated risks, capped at 60 so a long tail of low/medium risks can't fully zero the score. Severity weights unchanged: critical 25, high 15, medium 8, low 3, informational 1.
   - `score = clamp(0, 100, round(oppLift − riskDrag))`.

3. **Update the helper line** under the bar to: "Estimate combines average opportunity impact with unmitigated risk severity. Not a forecast."

4. **Adjust the positioning copy thresholds** to match the new distribution (most real solicitations will land 30–70):
   - `>= 65` aggressive
   - `>= 45` lean in
   - `< 30` reassess pursuit
   - otherwise balanced posture

## Files

- `src/features/analysis/components/CompetitivePositionSummary.tsx` — only file changed.

## Out of scope

- Persisting the score, changing the underlying risk/opportunity data model, or exposing the formula in settings.
- The earlier edge-function token-limit work.
