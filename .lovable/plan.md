# Risk status visibility — Option A + B

Make it obvious at a glance which risks are **Open** vs **Mitigated** across the Risks list and the Risk Mitigation tracker.

## What changes (user-facing)

1. **Status pill (Option A)** on every risk card, next to the severity badge:
   - Open → amber pill: `● Open`
   - Mitigated → green pill: `✓ Mitigated`
2. **Left accent stripe + dimming (Option B)** on each risk card:
   - Open → 4px amber left border, full opacity
   - Mitigated → 4px green left border, card opacity ~70% so it visually recedes
3. **Counter** at the top of the Risks list page: `Open (N) · Mitigated (M) · Total (T)`.
4. The Risk Mitigation tracker (Phase 1 → Risks) keeps showing only open risks (unchanged), but each row gets the amber stripe + `Open` pill for consistency.

No behavior changes — just visual status indicators. Existing "Mitigated on {date}" line and Reopen button stay as-is.

## Files to edit

- `src/features/risks/components/RiskCard.tsx` — add status pill + conditional border/opacity classes on the `<Card>`.
- `src/features/risks/components/RisksList.tsx` — add the Open/Mitigated/Total counter strip above the list.
- `src/features/analysis/components/RiskMitigationTracker.tsx` — add the amber stripe + `Open` pill on `UnmitigatedRow`.

## Design tokens

Use semantic tokens already defined for severity. Add two small helpers in `src/features/risks/utils/riskHelpers.ts`:

```ts
export const STATUS_PILL_OPEN = "border-amber-500/40 bg-amber-500/10 text-amber-700 dark:text-amber-300";
export const STATUS_PILL_MITIGATED = "border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300";
export const STATUS_STRIPE_OPEN = "border-l-4 border-l-amber-500";
export const STATUS_STRIPE_MITIGATED = "border-l-4 border-l-emerald-500 opacity-75";
```

(If the project prefers HSL semantic tokens over Tailwind named colors, swap to `--warning` / `--success` tokens from `index.css`; I'll check both files and pick whichever matches the existing convention before applying.)

## Out of scope

- Tabs/segmented filter (Option D).
- Changing the "Mark mitigated" button styling (Option C).
- Heatmap, exports, or schema changes.
