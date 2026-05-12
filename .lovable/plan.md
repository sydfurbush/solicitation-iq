# Why your data looks missing

Your account (sfurbush@emergenceconsultinggroup.com → org **Emergence CG**) has 4 solicitations under client **Inverness**, but the list filters them out:

| Title | Status | Why hidden |
|---|---|---|
| Transition assistance program (TAP) | intake | soft-deleted May 10 |
| Army Transition Assistance Program Services | intake | soft-deleted May 10 |
| W9124D26RA001 | archived | not surfaced by default |
| Army Transition Assistance Program Services | phase_1_complete | should be visible |

The list query in `useSolicitations` excludes `deleted_at IS NOT NULL`, and there's currently no UI to view archived/deleted items.

# Plan

## 1. One-time data restore
Run an UPDATE on `solicitations` to clear `deleted_at` for the two soft-deleted rows:
- `8ef773ec-9d3f-4c4f-a630-dd9981c4decb`
- `a86e3111-f505-4e85-8f82-7c74be52cf59`

You can re-archive or re-delete them from the UI afterward if you don't want them.

## 2. Add "Include archived / deleted" controls to the Solicitations list
- Extend `SolicitationFilters` with `includeArchived?: boolean` and `includeDeleted?: boolean` (both default `false` to preserve current behavior).
- Update `useSolicitations` query: only apply `.is("deleted_at", null)` when `!includeDeleted`; filter out `status = 'archived'` client-side unless `includeArchived` is on.
- Add two toggles (checkboxes) to `FiltersBar` next to the existing status filter.
- In the row actions menu, when a deleted row is shown, swap the "Archive" action for **Restore** (clears `deleted_at`). When an archived row is shown, add **Unarchive** (sets status back to `phase_1_complete` or previous — simplest: set to `intake` with confirmation, or just expose the existing status dropdown).
- Visually mark deleted rows (muted row + "Deleted" badge) and archived rows ("Archived" badge) so they're distinguishable.

## Scope guardrails
- No RLS changes — your org already owns these rows, they were just hidden by client-side filters and soft-delete.
- No changes to portal views or other pages.

Approve and I'll run the data restore migration first, then implement the toggle + restore UI.
