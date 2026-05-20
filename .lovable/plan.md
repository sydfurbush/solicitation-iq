# Fix: "Delete solicitation" shows success but row stays

## What's happening

You clicked Delete on a solicitation and got a "Deleted" toast, but the card remained in the list. After investigation, the underlying database row was never updated.

The specific solicitation you tried to delete ("Technical Advisory Support Services: Transition of Food for Peace to USDA", id `137d51e3...`) belongs to a **different organization** ("LLM Placement" under another org), not your Emergence CG org. Your account can see that row in the list because the visibility rule treats any owner/admin as a member of every solicitation, but the write rule (correctly) only allows updates inside your own org. The update therefore matched 0 rows and Supabase returned a 204 success with no error — so the UI happily showed "Deleted".

Two distinct problems to fix:

1. **UX bug** — the mutation does not verify that a row was actually updated, so a no-op (RLS-filtered) write looks like a success.
2. **Cross-org leak** — your org's user list view contains rows owned by other organizations because `is_solicitation_member` only checks role, not org. This is also why archive/restore would behave the same way for those rows.

## Plan

### 1. Make destructive mutations honest about no-ops

Update `useDeleteSolicitation`, `useRestoreSolicitation`, and `useArchiveSolicitation` (and the parallel client/solicitation mutations if they share the pattern) so each one:

- adds `.select("id")` to the update
- throws a clear error ("You don't have permission to modify this solicitation" or "Solicitation not found") when 0 rows come back

The dialog in `src/pages/Solicitations.tsx` already catches errors and shows a destructive toast, so this surfaces immediately.

### 2. Scope solicitation visibility to the current org

Change `is_solicitation_member(_user_id, _sol_id)` so the org-admin / org-staff branch only matches when the solicitation's client belongs to the user's org. New shape:

```text
is_org_admin(_user_id) AND solicitation belongs to a client in current_user_org()
OR EXISTS solicitation_assignments row for (_sol_id, _user_id)
```

This stops cross-org rows from appearing in the staff list and from being readable by SELECT policies that reuse this helper (annotations, documents, executive_reports, delta_actions, capability_gaps, etc.). Client-portal policies are not affected — they use `current_client_id()` paths.

After the helper changes, the existing `staff manage solicitations` write policy continues to work; the SELECT policy `view accessible solicitations` will simply stop returning foreign-org rows.

### 3. Verify

- Re-list solicitations as the affected user; the LLM Placement row should disappear.
- Delete one of your own org's solicitations; it should disappear and the toast should say "Deleted".
- Attempt the delete in a way that hits a foreign-org row (e.g. via direct id) — the toast should now be a destructive "You don't have permission…" message instead of a fake success.

## Out of scope

- Hard delete vs soft delete (still soft delete via `deleted_at`).
- Reviewing every other shared helper for org scoping beyond `is_solicitation_member`.
- Notifying other orgs that previously-visible rows are no longer visible.
