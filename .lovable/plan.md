# Add Editable Labels to Comparison Runs

## Goal
Let users name each archived comparison run (e.g. "Baseline", "After Amendment 3") so the history dropdown is easy to scan.

## Scope
UI-only. The `comparison_runs.label` column and `useUpdateRunLabel` mutation already exist — we just need to expose them.

## Changes

### 1. Label editor in the history picker
`src/features/comparison/components/ComparisonHistoryPicker.tsx`
- Add a small pencil/edit icon button next to the Select.
- Clicking it opens an inline input (or small popover) prefilled with the currently-selected run's label.
- Save calls `useUpdateRunLabel`; on success, toast + the dropdown reflects the new label.
- Disabled when "Latest run" is selected and no run is chosen — only labels archived runs. (We'll also allow labeling the latest run by resolving it to the top entry in `runs`.)

### 2. Inline label on the "viewing archived run" badge
`src/pages/SolicitationComparison.tsx`
- When viewing a historical run, show the label next to the run number badge, with the same edit affordance as a fallback entry point.

### 3. No backend or migration changes
The column, RLS, and mutation hook are already in place.

## Files touched
- `src/features/comparison/components/ComparisonHistoryPicker.tsx` — add edit control + input
- `src/pages/SolicitationComparison.tsx` — show label in the archived-run badge area

## Open question
Should labels be unique per solicitation (block duplicates like two "Baseline" entries), or freeform with no validation? Default: freeform.
