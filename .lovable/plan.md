## Problem
In the Capability Injector review step, the suggested-fields list is clipped — users can't scroll to see all extracted items below "Past performance". The `ScrollArea` is inside a flex column `DialogContent`, but it's missing `min-h-0`, so the viewport never gets a bounded height and the content overflows the dialog instead of scrolling.

## Fix (CapabilityInjectorDialog.tsx only)

1. Add `min-h-0` to the `ScrollArea` so the flex child can shrink and its internal viewport gets a real height:
   - `<ScrollArea className="flex-1 min-h-0 pr-3">`
2. Add `min-h-0` to the pre-extract `<div className="flex-1 overflow-auto …">` for consistency.
3. Make `DialogHeader` and `DialogFooter` `shrink-0` so they don't get squeezed and the middle region keeps its bounded height.
4. Bump dialog max height slightly (`max-h-[90vh]`) and widen content area to give more room for long extractions.
5. Keep all other behavior identical — no changes to extraction logic, schema, or apply flow.

## Why this works
Radix `ScrollArea` renders an inner viewport that only scrolls when its parent has a constrained height. In a flex column, `flex-1` alone isn't enough — the child also needs `min-h-0` so it can shrink below its content's intrinsic size. Once bounded, the viewport scrolls normally and reveals all extracted fields (NAICS, certifications, key personnel, etc.).

## Files
- `src/features/clients/components/CapabilityInjectorDialog.tsx` — 3-4 line changes to className strings.
