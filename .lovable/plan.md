# Fix "Mark mitigated" and "Suggest again" UX

## What's wrong

In `RiskMitigationTracker.tsx > UnmitigatedRow`:

1. **"Mark mitigated" does nothing.** The button is `disabled={!hasSaved || hasUnsaved}`. After clicking "Suggest mitigation", the textarea is populated but `saved` (DB value) is still empty, so `hasUnsaved = true` and the button is disabled. Clicking the disabled button is silent — the tooltip only appears on hover, so it feels like "nothing happens".

2. **"Suggest again" gives no clear used-state.** After a suggestion completes, the only signal is a small "AI suggested" badge near the severity chip. The button itself looks identical to before, so users can't tell it already ran and may click again by mistake.

## Fix

### 1. Make "Mark mitigated" always actionable when there is text

- Drop the `hasUnsaved` half of the disabled rule. Keep it disabled only when the textarea is empty (`strategy.trim().length === 0`).
- On click, if there are unsaved edits, save the strategy first, then mark mitigated (single user click = save + mitigate).
- Update the tooltip to only show when the textarea is empty: "Add mitigation notes before marking mitigated."
- Remove the now-stale "Save notes first, then mark mitigated." helper line.

### 2. Make "Suggest again" visibly used

- After a successful suggestion, while the textarea still matches the AI output (i.e. `aiSuggested === true` and user hasn't edited), change the button to a clear "used" state:
  - Label: "Suggestion applied" with a `Check` icon
  - Style: `variant="secondary"` (filled, distinct from the other outline buttons)
  - `disabled={true}` so a second click is impossible without intent
- As soon as the user edits the textarea (already flips `aiSuggested` to false) or clicks "Save notes", the button returns to "Suggest again" and is clickable.
- Keep the existing confirm dialog for re-suggesting over edited content.

## Files

- `src/features/analysis/components/RiskMitigationTracker.tsx` — only file touched.

## Out of scope

- Edge function / token-limit work (already addressed).
- Other risk list views.
