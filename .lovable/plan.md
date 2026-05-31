# Team Member Management

Add the missing controls to **Settings → Team → Members** so owners/admins can change a teammate's role or remove them, without touching the database.

## Scope

- Change a member's role between **admin**, **analyst**, **viewer**.
- Remove a member from the organization.
- Protect against foot-guns: can't change/remove yourself, can't remove the last owner, owner role can only be granted/revoked by another owner.
- Owners are listed but their role can only be edited by another owner.

Out of scope (can follow up): transferring ownership, "sign out everywhere", last-active timestamps, bulk actions.

## UX

In the existing **Members** card, each row gains two controls on the right:

```text
Sydney Furbush                          [Role ▾ Owner]   [⋯]
sfurbush@emergence...                                      └─ Remove from organization
```

- **Role dropdown** — inline Select with Owner / Admin / Analyst / Viewer. Disabled for the current user and for owners (unless the viewer is also an owner). Changing fires a confirm toast → mutation.
- **Remove (⋯ menu)** → "Remove from organization" opens a ConfirmDialog: "Remove {name} from {org}? They will lose access immediately." Disabled for self and for the last remaining owner.
- After success: invalidate `org-members` query, toast confirmation.
- Non-admins (analyst/viewer) keep read-only badges as today.

## Backend

Two new SECURITY DEFINER RPCs in `public`, callable only by org owners/admins, scoped to the caller's org:

1. `set_member_role(p_user_id uuid, p_role app_role)`
   - Validates: caller is owner/admin in same org as target; target is in caller's org; caller ≠ target; only owners can grant or revoke the `owner` role; if revoking `owner`, ensure at least one owner remains.
   - Implementation: delete existing rows in `user_roles` for that user with role in (owner/admin/analyst/viewer), insert the new role. Mirrors the pattern in `attach_existing_user_to_org`.

2. `remove_org_member(p_user_id uuid)`
   - Validates: caller is owner/admin; target is in caller's org; caller ≠ target; if target is owner, ensure another owner exists.
   - Action: delete from `user_roles`, set `users.organization_id = NULL` (keeps the auth account + their authored history intact). Does NOT delete the auth user.

Both raise descriptive exceptions that bubble up as toast errors.

No schema changes, no new tables, no RLS changes.

## Frontend

Edit only `src/features/team/components/TeamTab.tsx`:

- Read current user's role (already available via `useUser`) to decide whether owner options are enabled.
- Add `setRole` mutation calling `supabase.rpc('set_member_role', { p_user_id, p_role })`.
- Add `removeMember` mutation calling `supabase.rpc('remove_org_member', { p_user_id })` wrapped in ConfirmDialog.
- Replace the static `<Badge>` in the Members list with the Select + dropdown menu described above.
- Compute `ownerCount` from the members list to client-side-disable the last-owner actions (server still enforces).

## Technical notes

- RPCs use `SECURITY DEFINER ... SET search_path = public` like the other helpers in this project.
- Authorization helper: reuse `public.is_org_admin(auth.uid())` and `public.current_user_org()`.
- "Same org" check joins `public.users` for both caller and target.
- Owner-only escalation: `IF (NEW role = 'owner' OR OLD role = 'owner') AND NOT has_role(auth.uid(),'owner') THEN RAISE`.
- Last-owner guard: `SELECT count(*) FROM user_roles ur JOIN users u ON u.id=ur.user_id WHERE u.organization_id = v_org AND ur.role='owner'`.

## Migration order

1. Migration: create `set_member_role` and `remove_org_member` functions.
2. Edit `TeamTab.tsx` to wire the UI to the new RPCs.
