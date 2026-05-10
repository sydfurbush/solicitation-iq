## Issue
In `GenerateQuestionsDialog`, two things overflow / clip in the screenshot:
1. **Focus-area chips** (Technical, Management, Pricing, Compliance, Staffing) wrap onto a second line and "Staffing" sits awkwardly outside the dialog flow.
2. **Document filenames** (long PDF names like `IB01_Draft+RFP+Solicitation+-+W9124D26RA041+Professional+Appearance+(20260508).pdf`) overflow the right edge of the document list — the `truncate` class on the span isn't doing anything because its parent `<label>` has no width constraint, so the row grows wider than the ScrollArea and gets clipped.

## Plan

Single file: `src/features/questions/components/GenerateQuestionsDialog.tsx`

1. **Widen the dialog**: change `max-w-lg` → `max-w-2xl` so the focus chips fit on one line at typical desktop widths and filenames have more room.

2. **Keep focus-area chips on one line each**:
   - Add `whitespace-nowrap` to the chip `<label>` so each chip stays intact (it can still wrap to a new row, but never split mid-word).

3. **Fix filename truncation**:
   - Make the document `<label>` `flex w-full min-w-0`.
   - Keep `truncate` on the span and add `flex-1 min-w-0` so it actually shrinks and ellipsizes inside the scroll area.
   - Add `title={d.file_name}` so users can hover to see the full name.

4. **Optional polish**: add `pr-2` to the ScrollArea content area so the truncated text doesn't sit flush against the scrollbar.

No logic, props, hooks, or backend changes — purely layout/CSS fixes in one component.

## Verification
- Open the Generate dialog at the current viewport (~1231px) and confirm:
  - All 5 focus chips fit on one row (or wrap cleanly without clipping).
  - Long filenames show "…" ellipsis, full name on hover, no horizontal overflow.
- Resize down to ~640px (mobile) and confirm the dialog still fits and chips wrap gracefully.
