## Issues observed

**1. New preset overflows the page (horizontal scrollbar)**
The custom preset row "Technical Advisory Support Services: Transition of Food" has a long label. In `PresetRowItem` the label uses `truncate` (which sets `white-space: nowrap`) inside a `flex flex-wrap` parent without a constrained width. The unbroken span pushes the row wider than the card, which in turn pushes the right-side action buttons (history / clone / edit / **delete**) past the viewport — that's why the user can't reach Delete and why the page scrolls horizontally.

**2. Delete returned 403 once**
Network log shows a `PATCH …deleted_at` returning `42501 row-level security` for that preset. A second update on a sibling row succeeded with the same JWT, and the user is `owner` of the org — so RLS is configured correctly. The 403 was likely a one-off (stale session/role just after creation). Once the layout is fixed and the Delete button is reachable, retrying should work; if it still fails we'll surface the error and inspect further.

## Plan

### A. Fix the overflow so the Delete button is reachable

In `src/features/presets/components/PresetsTab.tsx` `PresetRowItem`:

- Give the left column a real width budget: `flex-1 min-w-0` (currently only `min-w-0`, so it doesn't actually shrink inside the parent flex).
- Remove `flex-wrap` from the badges row and add `min-w-0` so the truncate on the label takes effect.
- Keep the action column `shrink-0` and `gap-1`. No new buttons.

Result: long labels truncate with ellipsis, the row stays inside the card, and all four action icons (incl. Delete) remain visible at the current viewport.

### B. Make delete failures visible (defensive)

`useDeletePreset` already toasts on error — verify and keep. No code change unless retry still 403s after fix B; in that case we'll log the failing payload and revisit RLS.

### C. Sanity check after deploy

1. Reload Settings → Service Presets.
2. Confirm the long-label row is fully inside the card with no horizontal scrollbar.
3. Click the trash icon on "Technical Advisory Support Services: Transition of Food" → confirm dialog → Delete. Expect a 204 and the row to disappear.

## Files touched

- `src/features/presets/components/PresetsTab.tsx` (only the `PresetRowItem` JSX classes)

No DB / RLS / edge-function changes.