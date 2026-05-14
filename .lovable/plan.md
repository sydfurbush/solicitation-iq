## Goal

Let your team of 5 consultants share **one Emergence CG workspace** — same clients, solicitations, presets, reports — instead of each signup spinning up a brand-new organization.

## Why it happens today

When a new user signs up, the `handle_new_user` trigger reads the `organization_name` field from signup metadata and **always creates a brand-new organization** + makes that user its `owner`. There is no invite flow, so each teammate ends up isolated in their own org and can't see your data (RLS scopes everything by `organization_id`).

## Plan

### 1. Database — invitations table + invite-aware signup

Add `public.org_invitations`:
- `id`, `organization_id`, `email` (citext, lowercased), `role` (`admin` / `analyst` / `viewer`), `token` (uuid, unique), `invited_by`, `expires_at`, `accepted_at`, `created_at`.
- RLS:
  - Owners/admins of the org can `SELECT`, `INSERT`, `DELETE` rows for their own org.
  - The invited user (matched by email + token) can `SELECT` and `UPDATE` (to mark accepted) their own pending invite.
- New SECURITY DEFINER function `accept_org_invitation(token uuid)` that:
  1. Verifies invite is for `auth.email()`, not expired, not accepted.
  2. Sets `public.users.organization_id` for the caller to the invite's org.
  3. Inserts the matching row into `public.user_roles`.
  4. Marks the invite accepted.
- Update `handle_new_user`: if the new user's email has a pending unaccepted invite, attach them to that org + role instead of creating a new org. Only fall back to creating a fresh org when there's no invite **and** signup metadata included `organization_name`.

### 2. Edge function — `send-org-invitation`

- Auth-required. Caller must be `owner`/`admin` of their org.
- Inserts an invite row (or rotates token if one exists for that email).
- Sends an email with a sign-up link: `https://<app>/signup?invite=<token>` (or `/accept-invite?token=…` for already-signed-in users).
- Uses Resend (already used elsewhere) — if RESEND_API_KEY isn't set we'll request it.

### 3. Frontend

**A. New tab: Settings → "Team"** (visible to owner/admin only)
- List current org members: name, email, role, joined date, "remove" button.
- List pending invitations: email, role, sent date, "resend" / "cancel".
- "Invite member" form: email + role select → calls the edge function.

**B. Accept-invite handling**
- `Signup.tsx`: if URL has `?invite=<token>`, prefill the email (if encoded) and skip the "organization name" field; on successful signup the trigger auto-attaches the org.
- New page `/accept-invite?token=…` for users who already have an account: calls the `accept_org_invitation` RPC and redirects to the dashboard.

**C. Existing already-signed-up teammates**
- Owner gets a one-time button on the Team page: "Move existing user into org" (enter email) — a SECURITY DEFINER RPC that, if the email belongs to an existing user with no organization (or only their own empty org), reassigns them to the inviting org. This avoids them having to delete/recreate accounts.

### 4. Cleanup

- Audit query lists orphan single-user orgs created by the old behavior so you can decide which to keep.

## What you'll do after we ship

1. Open Settings → Team.
2. Click **Invite member**, enter each consultant's email, choose role (probably `analyst`).
3. They'll get an email; new sign-ups land in your Emergence CG org automatically. Existing teammate accounts can be migrated with the one-time "Move existing user" action.

## Files / surfaces touched

- New migration: `org_invitations` table + RLS + `accept_org_invitation` + updated `handle_new_user` + admin-only `attach_existing_user_to_org` RPC.
- New edge function: `supabase/functions/send-org-invitation/index.ts`.
- New: `src/features/team/components/TeamTab.tsx`, `useOrgInvitations.ts`.
- Modify: `src/pages/Settings.tsx` (add "Team" tab for owner/admin), `src/pages/Signup.tsx` (handle `invite` token), new `src/pages/AcceptInvite.tsx` + route in `App.tsx`.
- May need: confirm/add `RESEND_API_KEY` secret.

Approve and I'll build it. If you'd rather skip email sending in v1 and just generate copy-paste invite links, say so and I'll drop the edge function.