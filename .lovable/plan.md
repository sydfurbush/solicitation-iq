## Problem

In the Edit solicitation dialog, clicking the "Tags & Notes" tab (or any other tab) submits the form, which saves and closes the dialog — preventing the user from editing tags/notes or using "Save draft".

## Root cause

In `src/features/solicitations/components/SolicitationForm.tsx`, the wizard uses Radix `Tabs.Trigger` inside a `<form>`. Radix's `TabsTrigger` renders a native `<button>` and does not default `type` to `"button"`, so the browser treats it as `type="submit"`. Clicking any tab submits the form. On the Edit dialog this fires `updateMut.mutateAsync(...)` then `setOpen(false)` — the dialog closes.

A secondary issue: `SolicitationForm` calls `onDirtyChange(form.formState.isDirty)` directly in the render body, causing parent state updates during render. This should run inside a `useEffect`.

## Fix

1. In `SolicitationForm.tsx`:
   - Add `type="button"` to the `<TabsTrigger>` element so tab clicks never submit the form.
   - Move the `onDirtyChange` call into a `useEffect` keyed on `form.formState.isDirty` to avoid setState-in-render warnings/loops.

2. No changes to `EditSolicitationDialog.tsx`, validators, or hooks.

## Verification

- Open Edit solicitation → click through Basics → Dates → Financials → Tags & Notes; dialog stays open.
- Add/remove a tag, type notes, click "Save draft" — saves without closing prematurely; clicking "Save changes" on the last step still saves and closes.
- Create solicitation flow (which uses the same `SolicitationForm`) continues to work.
