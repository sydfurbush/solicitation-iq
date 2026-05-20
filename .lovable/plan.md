# Show all risks by default

## Problem

On the Risks step, only 5 of 12 risks are visible. Two causes:

1. **`RisksList`** groups risks by severity in collapsible sections, but only `Critical` and `High` are expanded by default. `Medium`, `Low`, and `Informational` groups stay collapsed, hiding their risks until clicked.
2. **`RiskMitigationTracker`** (the progress card) only renders open risks by design, so mitigated ones don't show there.

## Fix

### 1. Expand every severity group by default (`src/features/risks/components/RisksList.tsx`)
- Change `<Collapsible defaultOpen={sev === "critical" || sev === "high"}>` to `defaultOpen` (always open).
- Group counts already render in the header — users can collapse manually if they want.

### 2. Counter clarifies what's hidden where (already added)
- The new `Open N · Mitigated M · Total T` strip at the top of `RisksList` already makes the full count obvious.

### 3. RiskMitigationTracker — no change
- It's a "what still needs work" widget, so hiding mitigated risks is correct. The status pill + counter on the full list below makes it clear where mitigated risks live.

## Files changed

- `src/features/risks/components/RisksList.tsx` — one-line change to default-open all severity groups.

## Out of scope

- Adding a "Mitigated" section to the tracker (would dilute its purpose).
- Persisting the user's collapse/expand preference.
